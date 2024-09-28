import axios from "axios";

const fetchRandomBooks = async () => {
    const API_KEY = 'AIzaSyB84MLya_o_GNSq4JQgrPE8q77uHl_4g_U';
    const query = 'fiction';
    const maxResults = 40;  
    const startIndex = Math.floor(Math.random() * 100); 

    const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&startIndex=${startIndex}&maxResults=${maxResults}&key=${API_KEY}`;

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
            bookData.push(book);
        }); 

        return bookData;
    } catch (error) {
        console.error('Error fetching data:', error);
    }
};



export default fetchRandomBooks;
