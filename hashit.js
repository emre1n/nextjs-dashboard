const bcrypt = require('bcrypt');

const hashFunction = () => {
  const saltRounds = 10;
  const myPlaintextPassword = '123456';
  bcrypt.hash(myPlaintextPassword, saltRounds, function (err, hash) {
    console.log('hash', hash);
  });
};
hashFunction();
