const pages = {
  400: ['Check your request', 'We could not read that request. Please check your input and try again.'],
  404: ['Page not found', 'The page you are looking for is not available.'],
  413: ['Request too large', 'Please reduce the amount of data and try again.'],
  415: ['Unsupported request format', 'Please use a supported content type and encoding.'],
  500: ['Something went wrong', 'We could not complete your request. Please try again shortly.'],
};

export function notFound(request, response, next) {
  const error = new Error('Not found');
  error.status = 404;
  next(error);
}

export function errorHandler(log) {
  return (error, request, response, next) => {
    if (response.headersSent) return next(error);
    const candidate = error.status ?? error.statusCode;
    const status = Number.isInteger(candidate) && candidate >= 400 && candidate <= 599 ? candidate : 500;
    const [title, message] = pages[status] ?? (status < 500
      ? ['Request unavailable', 'We could not complete that request.'] : pages[500]);
    const errorType = ['Error', 'TypeError', 'SyntaxError', 'RangeError', 'ValidationError'].includes(error.name)
      ? error.name : 'Error';
    log('http.error', { requestId: response.locals.requestId, status, errorType });
    response.status(status).set('Cache-Control', 'no-store');
    // Raw exception text and stacks can contain credentials, queries and form data.
    response.render('errors/error', { title, message, status,
      diagnostic: request.app.get('env') === 'development' ? errorType : null }, (renderError, html) => {
      if (renderError) {
        log('view.error', { requestId: response.locals.requestId, status: 500 });
        response.status(500).type('text').send('Something went wrong. Please try again shortly.');
        return;
      }
      response.send(html);
    });
  };
}
