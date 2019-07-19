import config from './config.js';

export const genRestUrlFromUri = function(uri, protocol = 'https') {
	if (uri[0] === '/') {
		uri = uri.substring(1);
	}
	return protocol + '://' + config.restHttpsHost + ':' + config.restHttpsPort
		+ '/' + uri;
}
