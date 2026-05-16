import axios from "axios";

const instance = axios.create({
    baseURL:  import.meta.env.VITE_API_URL,
    withCredentials: true
    // headers: { 'X-Custom-Header': 'foobar' }
});

// Add a request interceptor
instance.interceptors.request.use(function (config) {
    return config;
}, function (error) {
    return Promise.reject(error);
});

instance.interceptors.response.use(function (response) {
    if (response.data) {
        return response.data
    }
    return response;
}, function (error) {
    return Promise.reject(error);
});

export default instance;