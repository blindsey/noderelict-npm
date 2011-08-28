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

exports.start = function( response ) {
  traces.splice( 0, traces.length ); // clear the traces
  if( response && response.end ) {
    var fn = response.end
    response.end = function() {
      fn.apply( this, arguments );
      exports.finish();
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

exports.finish = function() {
  console.log( traces );
};
