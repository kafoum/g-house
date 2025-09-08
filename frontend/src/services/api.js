import axios from 'axios';

const API = axios.create({
  baseURL: 'https://g-house-api.onrender.com/api',
});

export default API;