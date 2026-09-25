export function showHome(request, response) {
  response.render('home', { title: 'Welcome', activePage: 'home' });
}

export function showHealth(request, response) {
  response.status(200).set('Cache-Control', 'no-store').json({ status: 'ok' });
}
