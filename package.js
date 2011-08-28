var http = require( 'http' ),
    querystring = require( 'querystring' );

var token = '';

function instrument( request, name, fn ) {
  return function() {
    var start = new Date(), error;
    try {
      return fn.apply( this, arguments );
    } catch( e ) {
      error = e;
      throw e;
    } finally {
      var length = arguments.length;
      var args = new Array( length );
      for( var i = 0; i < length; ++i ) {
        var arg = arguments[i];
        args[i] = typeof( arg ) === 'function' ? 'function' : arg.toString();
      }
      var trace = { lib : name, args : args, time : (new Date() - start) };
      if( error ) trace.error = error;

      request.__nr.traces.push( trace );
    }
  }
}

function upload( request ) {
  var payload = {
    remoteAddress : request.headers['x-forwarded-for'] || request.connection.remoteAddress,
    method : request.method,
    url : request.url,
    referer : request.headers['referer'],
    userAgent : request.headers['user-agent'],
    sessionID : request.sessionID,
    totalTime : (new Date() - request.__nr.start)
    traces : request.__nr.traces
  };
  var body = { token : token, payload : JSON.stringify( payload ) };

  var client = http.createClient( 80, 'api.noderelict.com' );
  var client_request = client.request( 'POST', '/log', {
    'host' : 'api.noderelict.com',
    'User-Agent' : 'NodeJS HTTP Client ' + process.version,
    'Content-Type' : 'application/x-www-form-urlencoded'
  });

  client_request.end( querystring.stringify( body ) );
  client_request.on( 'response', function( response ) {
    if( response.statusCode !== '200' ) {
      console.error( new Date() + ' noderelict bad response ' + response.statusCode );

      var result = '';
      response.on( 'data', function( chunk ) {
        result += chunk;
      });

      response.on( 'end', function() {
        console.error( new Date() + ' noderelict ' + result );
      });
    }
  });
}

module.exports = function( _token ) {
  token = _token;
};

module.exports.start = function( request, response ) {
  request.__nr = { start : new Date(), traces : [] };
  response.on( 'end', function() { upload( request ) } );
};

module.exports.wrap = function( request, target ) {
  var type = typeof( target );
  if( type === 'function' ) {
    return instrument( request, '<anonymous>', target );
  } else if( type === 'string' ) {

    var lib = require( target );

    for( var key in lib ) {
      var value = lib[ key ];
      if( typeof( value ) === 'function' ) {
        lib[ key ] = instrument( request, target, value );
      }
    };

    return lib;
  }
};
