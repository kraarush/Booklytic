import express from 'express';
import pg from 'pg';
import bodyParser from 'body-parser';
import fetchRandomBooks from './fetchRandomBooks.js';
import bcrypt from 'bcrypt';
import env from 'dotenv';
import passport from 'passport';
import { Strategy } from 'passport-local';
import GoogleStrategy from 'passport-google-oauth2';
import session from 'express-session';

env.config();
const app = express();
const port = 3000;
const saltRounds = 10;
let isLoggedIn = false;
let emailToUpdatePassword = '';

// middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});
db.connect();

async function getData() {
  try {
    const result = await db.query("Select * from books");
    const data = result.rows;
    return data;
  }
  catch (err) {
    console.log(err);
  }
}

async function getDataById(id){
  try{
    const result = await db.query("Select * from books where id = $1", [id]);
    const data = result.rows[0];
    return data;
  }
  catch(err){
    console.log("Error in getDataById" + err);
  }
}

async function insertIfEmpty(apiData){
  try{
    apiData.forEach(async data => {
      await db.query("insert into books(title,author,rating,content,image,previewlink,booklink) values($1,$2,$3,$4,$5,$6,$7)",[data.title,data.author,data.rating,data.content,data.image,data.previewLink,data.bookLink]);
    });
    let data = await getData();
    return data;
  }
  catch(err){
    console.log("Error in insertIfEmpty" + err);
    res.send("here here")
  }
}

// app.get('/addmorebooks', async(req,res) => {
//   const apiData = await fetchRandomBooks();
//   let data = await insertIfEmpty(apiData);
//   console.log("successful");
//   res.send("done inserting data");
// });

app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.get('/forgotPassword',(req,res) => {
  res.render('forgotPassword.ejs');
});

app.get('/add', (req, res) => {
  try {
    res.status(200).render('addReview.ejs');
  }
  catch (err) {
    res.status(500).send("Internal Server error fetching the addReview.ejs file");
  }
});

app.get('/signOut', (req,res) => {
  try{
    isLoggedIn = false;
    res.redirect('/login');
  }
  catch(err){
    console.log("Error in signOut" + err);
    res.send("Error signing out " + err);
  }
});

app.get('/dashboard', async (req, res) => {
  try {
    let data = await getData();

    if(data.length === 0){
      let apiData = await fetchRandomBooks();
      data = await insertIfEmpty(apiData);
    }
    res.render("index.ejs", { bookData: data, isEmpty: data.length == 0 ? true:false, isLoggedIn: isLoggedIn});
  }
  catch (err) {
    console.log(err);
    res.status(500).send("Internal Server error fetching the index.ejs file");
  }
});

app.get('/delete/:id', async(req,res) => {
  try {
    const id = parseInt(req.params.id);
    console.log(id);

    await db.query("DELETE FROM books WHERE id = $1", [id]);

    res.status(200).redirect('/');
  }
  catch(err){
    res.status(500).send("Error deleting the data");    
  }
});

app.get('/edit/:id', async(req,res) => {
  try {
    const id = parseInt(req.params.id);
    let data = await getDataById(id);
    res.status(200).render('editReview.ejs',{bookData: data});
  }
  catch (err) {
    res.status(500).send("Internal Server error fetching the editReview.ejs file");
  }
});

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (checkResult.rows.length > 0) {
      res.status(400).render('register.ejs', { ifExist: true });
    }
    else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.log(err);
          res.send('Error hashing the password' + err);
        }
        else {
          const result = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) returning *",
            [email, hash]);
          res.redirect('/login');
        }
      });
    }
  }
  catch (err) {
    console.log(err);
  }

});

app.post("/login", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;

  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const storedHashedPassword = user.password;

      bcrypt.compare(password, storedHashedPassword, (err, result) => {
        if (err) {
          console.log(err);
          res.send('Error comparing the password' + err);
        }
        else {
          if (result) {
            isLoggedIn  =  true;
            res.redirect('/dashboard');
          }
          else{
            res.status(404).render('login.ejs',{isPasswordCorrect: false});
          }
        }
      });

    } else {
      res.send("User not found");
    }
  } catch (err) {
    console.log(err);
  }
});

app.post('/reset-password',async (req,res) => {
  const { email } = req.body;
  const result = await db.query("select * from users where email = $1",[email]);

  if(result.rows.length === 0){
    res.render('forgotPassword.ejs', {isExist: false, updatedPassword: false});
  }
  else{
    emailToUpdatePassword = email;
    res.render('forgotPassword.ejs', {isExist: true, updatedPassword: false});
  }
});

app.post('/set-new-password', async(req,res) => {
  const newPassword = req.body.newPassword;
  bcrypt.hash(newPassword,saltRounds, async (err,hash) => {
    if(err){
      console.log(err);
      res.send("Error hashing the new Password");
    }
    else{
      const result = await db.query("update users set password = $1 where email = $2",[hash,emailToUpdatePassword]);
      emailToUpdatePassword = '';
      res.render('updatedNewPassword.ejs');
    }
  })
});


app.post('/addReview', async (req, res) => {
  try {
    const title = req.body.title;
    const author = req.body.author;
    const rating = req.body.rating;
    const content = req.body.content;

    if (title && author && rating && content) {
      const result = await db.query("insert into books(title,author,rating,content) values($1,$2,$3,$4) returning *", [title, author, rating,content]);
      res.redirect('/');
    }
    else{
      res.render('addReview.ejs', {message: "Enter all values to proceed"});
    }
  }
  catch (err) {
    console.log(err);
    res.status(500).json({ type: 'Internal server error', message: 'Error inserting into database' });
  }
});

app.post('/editReview/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = await getDataById(id);
    const title = req.body.title || data.title;
    const author = req.body.author || data.author;
    const rating = req.body.rating || data.rating;
    const content = req.body.content || data.content;

    await db.query("UPDATE books SET title = $1, author = $2, rating = $3, content = $4 WHERE id = $5", [title, author, rating, content, id]);

    res.redirect('/');
  }
  catch (err) {
    console.log(err);
    res.status(500).json({ type: 'Internal server error', message: 'Error updating database' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on: http://localhost:${port}`);
});