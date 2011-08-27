var traces = [];

function instrument( name, fn ) {
  var start = new Date(), error;
  try {
    return fn.apply( this, arguments );
  } catch( e ) {
    error = e;
    throw e;
  } finally {
    var end = new Date();
    var data = { lib : name, args : arguments, time : end - start };
    if( error ) data.error = error;
    traces.push( data );
  }
}

exports.start = function() {
  traces.splice( 0, traces.length );
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
  for( var i = traces.length; i >= 0; --i ) {
    console.log( JSON.stringify( traces[ i ] ) );
  }
};
