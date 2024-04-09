const express = require('express');
const mySql   = require('mysql');
const cors    = require('cors');
const session = require('express-session');
const multer  = require('multer');
const path    = require('path');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const app = express();
app.use(cors());
app.use(express.json());
const fs = require('fs');
app.use(session({
  secret: 'tmcKry',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false, // Set to true if using HTTPS
    httpOnly: true,
  },
}));

const con = mySql.createConnection({
    user: "root",
    host: "localhost",
    password: "",
    database: "ftp",
});


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const clientId = req.body.clientId;
      const uploadPath = path.join(__dirname, 'src', 'files', clientId);
      
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    },
  });
  
  const upload = multer({ storage });

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'niteshdkbp806@gmail.com',
      pass: 'Nitesh@dkbp',
    },
  });

app.post('/register', (req, res) => {

    const { fullname, email, password } = req.body;

    con.query(
        'SELECT * FROM admins WHERE email = ?',
        [email],
        (err, result) => {
            if (err) {
                console.error(err);
                res.status(500).send({ message: "Internal server error" });
            } else if (result.length > 0) {
                res.send({ message: 'User already exists please login' });
            } else {
                con.query(
                    'INSERT INTO admins (fullname,email, password) ' +
                    'VALUES (?, ?, ?)',
                    [fullname, email, password],
                    (err, result) => {
                        if (err) {
                            console.error(err);
                            res.status(500).send({ message: "Internal server error" });
                        } else {
                            res.send({ message: 'Registration successful',  redirect: '/login'});
                        }
                    }
                );
            }
        }
    );

});
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    con.query(
        "SELECT * FROM admins WHERE email = ? AND password = ?",
        [username, password],
        (err, result) => {
            if (err) {
                console.error(err);
                res.status(500).send({ message: "Internal server error" });
            } else {
                if (result.length === 1) {
                  const user = result[0];
                  const { email, password } = user;
        
                  // Set user information in the session
                  req.session.user = { email, password };
                  res.send(req.session.user);
                  console.log('Session after Setting :', req.session.user ); 
                  console.log('User logged in successfully!');
                } else {
                  res.status(401).send({ message: "Invalid credentials" });
                }
            }
        }
    );
});

app.post('/client', (req, res) => {
    const { clientName, clientEmail, clientStatus, clientPassword } = req.body;
  
    // Generate a verification token
    // const verificationToken = uuidv4();
  
    con.query(
      'SELECT * FROM clients WHERE clientEmail = ?',
      [clientEmail],
      (err, result) => {
        if (err) {
          console.error(err);
          res.status(500).send({ message: 'Internal server error in client' });
        } else if (result.length > 0) {
          res.send({ message: 'Client already exists' });
        } else {
          const firstName = clientName.split(' ')[0];
          const clientId = `TC_${firstName}`;
          con.query(
            'INSERT INTO clients (clientName, clientId, clientEmail, clientStatus, clientPassword) ' +
              'VALUES (?, ?, ?, ?, ?)',
            [clientName, clientId, clientEmail, clientStatus, clientPassword],
            (dbErr, dbResult) => {
              if (dbErr) {
                console.error(dbErr);
                res.status(500).send({ message: 'Internal server error' });
              } else {
                res.send({ message: 'Client added successfully.' });
              }
            }
          );
          // Send verification email
          // const verificationLink = `http://192.168.1.10/:3002/verify/${verificationToken}`;
          // const mailOptions = {
          //   from: 'niteshdkbp806@gmail.com',
          //   to: clientEmail,
          //   subject: 'Email Verification',
          //   text: `Click the following link to verify your email:  ${verificationLink}`,
          // };
  
          // transporter.sendMail(mailOptions, (mailErr, info) => {
          //   if (mailErr) {
          //     console.error(mailErr);
          //     res.status(500).send({ message: 'Error sending verification email' });
          //   } else {
          //     // Save user data and verification token to the database

          //   }
          // });
        }
      }
    );
  });
app.get('/clientdata',  (req, res,) => {
    const user = req.session.user;
   console.log("Session Data::",user);
    // if (! req.session.user) {
    //       console.log('Unauthorized access to Client Data. Session:', req.session);
    //       res.status(401).send({ message: 'Unauthorized' });
    //       return;
    // }
    con.query('SELECT * FROM clients', (err, result) => {
      if (err) {
        console.error('Error querying MySQL:', err);
        res.status(500).send({ message: 'Internal server error' });
        return;
      }
      console.log(result);
      res.send(result);
    });
  });

  app.post('/upload', upload.single('file'), async (req, res) => {
    const { clientId, clientName, clientEmail, fileType, fileMonth } = req.body;
    const fileName = req.file.originalname;
    // const uploadMonth = new Date().getMonth() + 1;
    const uploadMonth = new Date().toLocaleString('en-US', { month: 'long' }); // Get full month name
    const uploadYear = new Date().getFullYear();
    const uploadDate = new Date().toISOString().split('T')[0];

    const file_name_with_month = `${fileName}`;

    try {
      // Dynamically create the table if it doesn't exist
      await con.query(`CREATE TABLE IF NOT EXISTS \`${clientId}\` (
        uid SERIAL PRIMARY KEY,
        filetype VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_month VARCHAR(255) NOT NULL,
        upload_date DATE NOT NULL,
        upload_month VARCHAR(255) NOT NULL,
        upload_year INT NOT NULL
      )`);
  
      // Insert data into the dynamically created table
      const insertQuery = `INSERT INTO \`${clientId}\` (name,fileType,file_month, file_name,upload_date, upload_month, upload_year) VALUES (?,?, ?,?, ?, ?, ?)`;
      await con.query(insertQuery, [clientName,fileType,fileMonth, file_name_with_month,uploadDate, uploadMonth, uploadYear]);
  
      res.status(200).json({ message: 'File uploaded successfully' });
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  app.get('/getFileData/:clientId', async (req, res) => {
    const clientId = req.params.clientId;

    con.query(`SELECT * FROM \`${clientId}\``, (err, result) => {
        if (err) {
          console.error('Error querying MySQL:', err);
          res.status(500).send({ message: 'Internal server error' });
          return;
        }
        console.log(result);
        res.send(result);
      });
  });
  // Client Update
  app.post('/edit-client/:clientId', (req, res) => {
    const clientId = req.params.clientId;
    const { clientName, clientEmail, clientStatus, clientPassword } = req.body;
    
    // Use UPDATE statement to modify existing data in the client table
    const updateQuery = 'UPDATE client SET clientName=?, clientEmail=?, clientStatus=?, clientPassword=? WHERE clientId=?';
    
    con.query(updateQuery, [clientName, clientEmail, clientStatus, clientPassword, clientId], (err, result) => {
      if (err) {
        res.status(500).send({ message: 'Internal server error' });
      } else {
        res.status(200).send({ message: 'Client ' + clientName + ' updated successfully' });
      }
    });
  });
  
  

  app.post('/admin-logout', (req, res) => {
    // Clear the session to log the admin out
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        res.status(500).send({ message: 'Logout failed' });
      } else {
        res.status(200).send({ message: 'Admin logout successful' });
      }
    });
  });


app.listen(3002, 'https://ftpserver.netlify.app/', () => {
    console.log("Server is listening on port 3002. Ready for connections.");
});
