const express = require("express");
const cors = require('cors');
const User = require("./models/models");
const app = express();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const nodemailer = require("nodemailer");
const Stripe = require('stripe');
const stripe = Stripe('sk_test_51GsFA7EZJORHGbIlDHiPX8oa54qJGrfnoFwcVzMK2tbeE7KPZu8N6HPOBxo7fhrc4nEz7PqiQu0ualHpHMNUMpbq00xcJk7Nzc');
const dotenv = require('dotenv');
dotenv.config();

app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.post("/sendForm", (request, response) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.USEREMAIL,
      pass: process.env.EMAILPASSWORD
    }
  });

  const mailOptions = {
    from: request.body.email,
    to: '"' + process.env.USEREMAIL + '"',
    subject: `Message from ${request.body.email}: ${request.body.subject}`,
    text: request.body.message
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      response.json({ "message": 'Email not successfully sent' });
    } else {
      response.json({ "message": "Email successfully sent" });
    }
  });
});

const calculateOrderAmount = (items) => {
  // Replace this constant with a calculation of the order's amount
  // Calculate the order total on the server to prevent
  // people from directly manipulating the amount on the client
  return 1400;
};

app.post("/send-invoice", async (request, response) => {
  const invoiceItem = await stripe.invoiceItems.create({
    customer: 'cus_4fdAW5ftNQow1a',
    price: 'price_CBb6IXqvTLXp3f',
  });
  const invoice = await stripe.invoices.create({
    customer: 'cus_4fdAW5ftNQow1a',
    auto_advance: true, // Auto-finalize this draft after ~1 hour
    collection_method: 'charge_automatically'
  });
  // const invoice = await stripe.invoices.finalizeInvoice('id');
});

app.post("/create-payment-intent", cors(), async (request, response) => {
  // const { item } = request.body;
  // Create a PaymentIntent with the order amount and currency
  const paymentIntent = await stripe.paymentIntents.create({
    amount: calculateOrderAmount(),
    currency: "eur",
    automatic_payment_methods: {
      enabled: true,
    },
  });

  const customer = await stripe.customers.create({
    name: 'chiho liu',
    email: 'chiholiu10@gmail.com',
    description: 'My first test customer',
  });

  response.json({ clientSecret: paymentIntent.client_secret, customer: customer });
});

const generateAccessToken = (signinData) => {
  return jwt.sign(signinData, process.env.TOKEN_SECRET, { expiresIn: '1500s' });
};

const sendResetEmail = (email, link) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.USEREMAIL,
      pass: process.env.GOOGLEGENERATEDPASSWORD
    }
  });

  const mailOptions = {
    from: process.env.USEREMAIL,
    to: email,
    subject: `Verify your email`,
    text: `Check this email to reset your password<a href=${link} target="_blank"></a>`
  };

  transporter.sendMail(mailOptions, (error) => {
    if (error) {
      console.log(error);
      console.log('email not sent');
      // response.status(200).json({ "message": "Email not successfully sent" });
    } else {
      console.log('email sent');

      // response.status(400).json({ "message": "successfully sent" });
    }
  });
};

app.post("/forget-password", async (request, response) => {
  const { email } = request.body;
  User.findOne({ email: email }).then((user) => {
    const JWT_SECRET = "super secret";
    const secret = JWT_SECRET + user.password;

    const payload = {
      email: user.email,
      id: user.id
    };

    const token = jwt.sign(payload, secret, { expiresIn: "100h" });
    const link = `http://localhost:3000/reset-password/${user.id}/${token}`;
    sendResetEmail(user.email, link);
    response.status(200).json({
      "message": `Reset password link has been sent to ${email}, please check your inbox ` + `<a href=${link} />{ link }</a >`
    });
  }).catch((err) => {
    response.status(401).json({ "message": "Email not exists" });
  });
});

app.get("/reset-password/:id/:token", (request, response) => {
  const { id, token } = request.params;
  const { password } = request.body;
  User.findOne({ _id: id }).then(user => {
    const JWT_SECRET = "super secret";
    const secret = JWT_SECRET + user.password;
    const payload = jwt.verify(token, secret);

    user.password = password;
    response.status(200).json({ "message": "Password successfully changed" });
  }).catch((err) => {
    response.status(401).json({ "message": "Something went wrong. Try again please" });
  });
});

app.post("/reset-password/:id/:token", async (request, response) => {
  const { id, token } = request.params;
  const { password } = request.body;
  User.findOne({ _id: id }).then(user => {
    const JWT_SECRET = "super secret";
    const secret = JWT_SECRET + user.password;

    const payload = jwt.verify(token, secret);
    user.password = password;
    response.status(200).json({ "message": "Password successfully changed" });
  }).catch((err) => {
    console.log(err);
    response.status(401).json({ "message": "Something went wrong. Try another url please" });
  });
});

app.post("/login", (request, response) => {
  const { username, password } = request.body;
  User.findOne({ username: username }).then((user) => {
    const token = generateAccessToken({ username: user.username, password: user.password });
    const expireDate = new Date(Date.now() + (30 * 86400 * 100));
    response.cookie('access_token', token, {
      expires: expireDate,
      httpOnly: true,
      secure: true,
      sameSite: "none"
    }).cookie("checkToken", true, {
      expires: expireDate,
      secure: true,
      sameSite: "none"
    });

    const refreshToken = jwt.sign(user.username, process.env.REFRESH_TOKEN_SECRET);
    response.status(200).header('Access-Control-Allow-Credentials', true, "auth-token", token).json({ "message": "Successfully logged in", "token": token, "refreshToken": refreshToken });
  }).catch((err) => {
    response.status(401).json({ "message": "Invalid Credentials" });
  });
});

app.post('/logout', (request, response) => {
  console.log('test');
  response.clearCookie('access_token');
  response.clearCookie('checkToken');
  return response.sendStatus(200);
});

app.post('/register', async (request, response) => {
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = await bcrypt.hash(request.body.password, salt);

  try {
    const emailExists = await User.find({ $or: [{ username: request.body.username }, { email: request.body.email }] });
    if (emailExists.length > 0 && emailExists !== null) {
      console.log("Email already exitsts");
      return response.status(404).json({ "message": "Email already exitsts" });
    }

    let user = new User({
      username: request.body.username,
      email: request.body.email,
      password: hashedPassword
    });
    user.save();
    console.log('Successfully registered"');
    response.status(200).json({ "message": "Successfully registered" });
  } catch (error) {
    console.log('User not added"');
    response.status(400).json({ "message": "User not added" });
  }
});

module.exports = app;