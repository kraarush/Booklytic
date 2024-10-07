import env from 'dotenv';
env.config();

const fetchRandomBooks = async () => {
    const api_url = "https://www.googleapis.com/books/v1/volumes";
    const API_KEY = process.env.GOOGLE_BOOK_API_KEY;
    const query = 'fiction';
    const maxResults = 40;
    const startIndex = Math.floor(Math.random() * 100); 

    const url = `${api_url}?q=${query}&startIndex=${startIndex}&maxResults=${maxResults}&key=${API_KEY}`;
    console.log(url);
    try {
        const response = await fetch(url);
        const data = await response.json();
        let bookData = [];

        data.items.forEach((item) => {
            const book = {
                title: item.volumeInfo.title || 'No Title',
                author: item.volumeInfo.authors ? item.volumeInfo.authors[0] : 'Unknown Author',
                rating: item.volumeInfo.averageRating || Math.floor(Math.random()*6),
                content: item.volumeInfo.description || 'No Review available',
                image: item.volumeInfo.imageLinks ? item.volumeInfo.imageLinks.thumbnail : 'No image',
                previewLink: item.volumeInfo.previewLink || 'No preview available',
                bookLink: item.volumeInfo.infoLink || 'No info available',
            };
            
            if (book.title.charAt(0).match(/[a-zA-Z]/)) {
                book.title = book.title.charAt(0).toUpperCase() + book.title.slice(1).toLowerCase();
            }

            bookData.push(book);
        }); 

        return bookData;
    } catch (error) {
        console.error('Error fetching data:', error);
    }
};

export default fetchRandomBooks;