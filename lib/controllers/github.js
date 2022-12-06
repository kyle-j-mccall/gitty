const { Router } = require('express');
const {
  exchangeCodeForToken,
  getGitHubProfile,
} = require('../services/github');
const jwt = require('jsonwebtoken');
const authenticate = require('../middleware/authenticate');
const { GithubUser } = require('../models/GithubUser');
const ONE_DAY_IN_MS = 1000 * 60 * 60 * 24;

module.exports = Router()
  .get('/callback', async (req, res, next) => {
    try {
      // get the code from the URL Search Params
      const { code } = req.query;
      // exchange the code for a token
      const token = await exchangeCodeForToken(code);
      // use the token to get info about the user from Github
      const { email, login, avatar_url } = await getGitHubProfile(token);
      // create a user with that info in our database
      let user = await GithubUser.findBylogin(login);
      if (!user) {
        user = await GithubUser.insert({
          login,
          email,
          avatar: avatar_url,
        });
      }
      console.log('user: ', user);
      const payload = jwt.sign({ ...user }, process.env.JWT_SECRET, {
        expiresIn: '1 day',
      });
      //  * set cookie and redirect
      res
        .cookie(process.env.COOKIE_NAME, payload, {
          httpOnly: true,
          maxAge: ONE_DAY_IN_MS,
        })
        .redirect('/api/v1/github/dashboard');
    } catch (e) {
      next(e);
    }
  })
  .get('/login', (req, res) => {
    res.redirect(
      `https://github.com/login/oauth/authorize?client_id=${process.env.GH_CLIENT_ID}&scope=user&redirect_uri=${process.env.GH_REDIRECT_URI}`
    );
  })
  .get('/dashboard', [authenticate], (req, res) => {
    res.json(req.user);
  });
