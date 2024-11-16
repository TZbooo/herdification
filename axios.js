const axios = require('axios');

axios.defaults.headers.common['Content-Type'] = 'application/json';

module.exports = axios;
