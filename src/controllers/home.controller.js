export function showHome(request, response) {
  response.render('home', { title: 'Welcome', activePage: 'home' });
}
