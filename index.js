import express from 'express';
import pg from 'pg';
import axios from 'axios';
import bodyParser from 'body-parser';
import fetchRandomBooks from './fetchRandomBooks.js';

const app = express();
const port = 4000;
const api_url = "https://openlibrary.org/dev/docs/api/covers";
const api_key = 'AIzaSyB84MLya_o_GNSq4JQgrPE8q77uHl_4g_U';

// middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "Bookstore_Capstone_Project",
  password: "aarush",
  port: 5432,
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

app.get('/', async (req, res) => {
  try {
    let data = await getData();

    if(data.length === 0){
      let apiData = await fetchRandomBooks();
      data = await insertIfEmpty(apiData);
    }
    res.render("index.ejs", { bookData: data, isEmpty: data.length == 0 ? true:false});
  }
  catch (err) {
    console.log(err);
    res.status(500).send("Internal Server error fetching the index.ejs file");
  }
});

app.get('/add', (req, res) => {
  try {
    res.status(200).render('addReview.ejs');
  }
  catch (err) {
    res.status(500).send("Internal Server error fetching the addReview.ejs file");
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
})

app.listen(port, () => {
  console.log(`Server is running on: http://localhost:${port}`);
});