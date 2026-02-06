(function () {
  'use strict';
  var TOKEN_KEY = 'costlyf_access_token';
  var REFRESH_KEY = 'costlyf_refresh_token';

  function refreshToken() {
    var refresh = localStorage.getItem(REFRESH_KEY);
    if (!refresh) return Promise.resolve(null);
    return fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh })
    })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (result) {
        if (result.ok && result.data.access_token) {
          localStorage.setItem(TOKEN_KEY, result.data.access_token);
          if (result.data.refresh_token) localStorage.setItem(REFRESH_KEY, result.data.refresh_token);
          return result.data.access_token;
        }
        return null;
      })
      .catch(function () { return null; });
  }

  window.Auth = {
    getToken: function () {
      return localStorage.getItem(TOKEN_KEY);
    },
    setSession: function (accessToken, refreshToken) {
      if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
      if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    },
    clearSession: function () {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
    },
    isLoggedIn: function () {
      return !!localStorage.getItem(TOKEN_KEY) || !!localStorage.getItem(REFRESH_KEY);
    },
    refreshToken: refreshToken,
    fetchWithAuth: function (url, options) {
      options = options || {};
      options.headers = options.headers || {};
      var token = this.getToken();
      if (token) options.headers.Authorization = 'Bearer ' + token;
      var self = this;
      return fetch(url, options).then(function (response) {
        if (response.status === 401 && self.getToken()) {
          return refreshToken().then(function (newToken) {
            if (newToken) {
              var opts = Object.assign({}, options);
              opts.headers = Object.assign({}, opts.headers, { Authorization: 'Bearer ' + newToken });
              return fetch(url, opts);
            }
            return response;
          });
        }
        return response;
      });
    }
  };
})();
