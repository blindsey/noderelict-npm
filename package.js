var http = require( 'http' ),
    querystring = require( 'querystring' );

var token = '';
var traces = [];

function instrument( name, fn ) {
  return function() {
    var start = new Date(), error;
    try {
      return fn.apply( this, arguments );
    } catch( e ) {
      error = e;
      throw e;
    } finally {
      var end = new Date();

      var length = arguments.length;
      var args = new Array( length );
      for( var i = 0; i < length; ++i ) {
        var arg = arguments[i];
        args[i] = typeof( arg ) === 'function' ? 'function' : arg.toString();
      }
      var data = { lib : name, args : args, time : end - start };
      if( error ) data.error = error;

      traces.push( data );
    }
  }
}

exports.token = function( _token ) {
  token = _token;
};

exports.start = function( response ) {
  traces.splice( 0, traces.length ); // clear the traces
  if( response && response.end ) {
    var fn = response.end
    response.end = function() {
      fn.apply( this, arguments );
      exports.finish( request );
    }
  }
};

exports.wrap = function( target ) {
  var type = typeof( target );
  if( type === 'function' ) {
    return instrument( 'anonymous', target );
  } else if( type === 'string' ) {

    var lib = require( target );

    for( var key in lib ) {
      var value = lib[ key ];
      if( typeof( value ) === 'function' ) {
        lib[ key ] = instrument( target, value );
      }
    };

    return lib;
  }
};

exports.finish = function( request ) {
  if( !token ) {
    console.error( 'You must configure a token before sending data' );
    return;
  }

  var payload = {
    remoteAddress : request.headers['x-forwarded-for'] || request.connection.remoteAddress,
    method : request.method,
    url : request.url,
    referer : request.headers['referer'],
    userAgent : request.headers['user-agent'],
    sessionID : request.sessionID,
    traces : traces
  };
  var body = { token : token, payload : JSON.stringify( payload ) };

  var client = http.createClient( 80, 'www.noderelict.com' );
  var client_request = client.request( 'POST', '/log', {
    'host' : 'www.noderelict.com',
    'User-Agent' : 'NodeJS HTTP Client ' + process.version,
    'Content-Type' : 'application/x-www-form-urlencoded'
  });

  client_request.end( querystring.stringify( body ) );
  client_request.on( 'response', function( response ) {
    if( response.statusCode !== '200' ) {
      console.error( new Date() + ' noderelict unexpexted ' + response.statusCode );

      var result = '';
      response.on( 'data', function( chunk ) {
        result += chunk;
      });

      response.on( 'end', function() {
        console.error( new Date() + ' noderelict ' + result );
      });
    }
  });
};
