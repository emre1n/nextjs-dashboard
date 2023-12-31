import db from '@/database/db';
import {
  CustomerField,
  CustomersTable,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  User,
  Revenue,
} from './definitions';
import { formatCurrency } from './utils';
import { unstable_noStore as noStore } from 'next/cache';
import { Customer } from './definitions';

type Status = 'pending' | 'paid';

export async function fetchRevenue() {
  noStore();
  // Add noStore() here prevent the response from being cached.
  // This is equivalent to in fetch(..., {cache: 'no-store'}).

  try {
    // Artificially delay a response for demo purposes.
    // Don't do this in production :)

    console.log('Fetching revenue data...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const data = await db.revenue.findMany();

    const transformedData: Revenue[] = data.map((obj) => ({
      month: obj.month,
      revenue: obj.revenue,
    }));

    return transformedData;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  noStore();
  try {
    const data = await db.invoice.findMany({
      select: {
        amount: true,
        customer: {
          select: {
            name: true,
            email: true,
            image_url: true,
          },
        },
        id: true,
      },
      orderBy: {
        date: 'desc',
      },
      take: 5,
    });

    const transformedData = data.map((invoice) => ({
      id: invoice.id.toString(),
      name: invoice.customer.name,
      image_url: invoice.customer.image_url,
      email: invoice.customer.email,
      amount: invoice.amount,
    }));

    const latestInvoices = transformedData.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  noStore();
  try {
    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.
    const invoices = await db.invoice.findMany();
    const customers = await db.customer.findMany();
    const paidInvoices = await db.invoice.findMany({
      where: {
        status: 'paid', // Filter invoices with status 'paid'
      },
    });

    const pendingInvoices = await db.invoice.findMany({
      where: {
        status: 'pending', // Filter invoices with status 'pending'
      },
    });

    const totalPaidAmount = paidInvoices.reduce(
      (acc, amount) => acc + amount.amount,
      0,
    );
    const totalPendingAmount = pendingInvoices.reduce(
      (acc, amount) => acc + amount.amount,
      0,
    );

    const data = await Promise.all([
      invoices,
      customers,
      totalPaidAmount,
      totalPendingAmount,
    ]);

    const numberOfInvoices = data[0].length;
    const numberOfCustomers = data[1].length;
    const totalPaidInvoices = formatCurrency(data[2]);
    const totalPendingInvoices = formatCurrency(data[3]);

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  try {
    const offset = (currentPage - 1) * ITEMS_PER_PAGE;

    const invoicesData = await db.invoice.findMany({
      include: {
        customer: true,
      },
      where: {
        OR: [
          {
            customer: {
              name: {
                startsWith: query,
              },
            },
          },
          {
            customer: {
              email: {
                startsWith: query,
              },
            },
          },
          {
            status: {
              startsWith: query,
            },
          },
        ],
      },
      take: ITEMS_PER_PAGE,
      skip: offset,
    });

    const invoices = invoicesData.map((invoice) => {
      return {
        id: invoice.id,
        customerId: invoice.customerId,
        amount: invoice.amount,
        status: invoice.status,
        date: invoice.date.toString(),
        name: invoice.customer.name,
        email: invoice.customer.email,
        image_url: invoice.customer.image_url,
      };
    });
    return invoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const count = await db.invoice.count({
      where: {
        OR: [
          { customer: { name: { contains: query } } },
          { customer: { email: { contains: query } } },
          { status: { contains: query } },
        ],
      },
      orderBy: {
        date: 'desc',
      },
    });
    const totalPages = Math.ceil(count / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    const invoice = await db.invoice.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        customerId: true,
        amount: true,
        status: true,
      },
    });
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Convert amount from cents to dollars
    invoice.amount /= 100;

    // Ensuring status type safety
    const status: Status = invoice.status as Status;

    const invoiceWithEnumStatus = {
      ...invoice,
      status: status,
    };

    return invoiceWithEnumStatus;
  } catch (error) {
    console.error('Database Error:', error);
    // throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  try {
    const data = await db.customer.findMany();

    const customers = data;
    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

// export async function fetchFilteredCustomers(query: string) {
//   try {
//     const data = await sql<CustomersTable>`
// 		SELECT
// 		  customers.id,
// 		  customers.name,
// 		  customers.email,
// 		  customers.image_url,
// 		  COUNT(invoices.id) AS total_invoices,
// 		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
// 		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
// 		FROM customers
// 		LEFT JOIN invoices ON customers.id = invoices.customer_id
// 		WHERE
// 		  customers.name ILIKE ${`%${query}%`} OR
//         customers.email ILIKE ${`%${query}%`}
// 		GROUP BY customers.id, customers.name, customers.email, customers.image_url
// 		ORDER BY customers.name ASC
// 	  `;

//     const customers = data.rows.map((customer) => ({
//       ...customer,
//       total_pending: formatCurrency(customer.total_pending),
//       total_paid: formatCurrency(customer.total_paid),
//     }));

//     return customers;
//   } catch (err) {
//     console.error('Database Error:', err);
//     throw new Error('Failed to fetch customer table.');
//   }
// }

// export async function getUser(email: string) {
//   try {
//     const user = await sql`SELECT * FROM users WHERE email=${email}`;
//     return user.rows[0] as User;
//   } catch (error) {
//     console.error('Failed to fetch user:', error);
//     throw new Error('Failed to fetch user.');
//   }
// }
