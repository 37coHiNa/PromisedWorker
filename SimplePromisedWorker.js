const isWorkerThread = ( typeof WorkerGlobalScope != "undefined" );

class PromisedWorker extends Worker {
  
  #requests = new Map();

  static #responseHandler = ( { status, message }, { resolve, reject } ) => {

    switch ( status ) {

      case "success":
        resolve( message );
        return;

      case "failure":
        reject( message );
        return;

    }

  };

  constructor( ...args ) {

    super( ...args );

    this.addEventListener( "message", event => {

      const { requestID, status, message } = event.data;

      if ( this.#requests.has( requestID ) ) {

        const { resolve, reject } = this.#requests.get( requestID );
        this.constructor.#responseHandler( { status, message }, { resolve, reject } );

      } else {

        this.#requests.set( requestID, { status, message } );

      }

    } );

    this.addEventListener( "error", event => {

      console.error( event );

    } );

  }

  async postMessage( message, transfer ) {

    const requestID = this.constructor.#uuidIte.next().value;

    super.postMessage( { requestID, message }, transfer );

    const returnMessage = await new Promise( ( resolve, reject ) => {

      if ( this.#requests.has( requestID ) ) {
      
        const { status, message } = this.#requests.get( requestID );
        this.constructor.#responseHandler( { status, message }, { resolve, reject } );

      } else {

        this.#requests.set( requestID, { resolve, reject } );

      }

    } );

    this.#requests.delete( requestID );

    return returnMessage;

  }

  static #uuidIte = ( function* () {

    //RFC 4122
    const HEXOCTETS = Object.freeze( [ ...Array(256) ].map( ( e, i ) => i.toString( 16 ).padStart( 2, "0" ).toUpperCase() ) );
    const VARSION = 0x40;
    const VARIANT = 0x80;

    for (;;) {

      const s0 = Math.random() * 0x100000000 >>> 0;
      const s1 = Math.random() * 0x100000000 >>> 0;
      const s2 = Math.random() * 0x100000000 >>> 0;
      const s3 = Math.random() * 0x100000000 >>> 0;
      yield "" +
        HEXOCTETS[ s0 & 0xff ] +
        HEXOCTETS[ s0 >>> 8 & 0xff ] +
        HEXOCTETS[ s0 >>> 16 & 0xff ] +
        HEXOCTETS[ s0 >>> 24 & 0xff ] + "-" +
        HEXOCTETS[ s1 & 0xff ] +
        HEXOCTETS[ s1 >>> 8 & 0xff ] + "-" +
        HEXOCTETS[ s1 >>> 16 & 0x0f | VARSION ] +
        HEXOCTETS[ s1 >>> 24 & 0xff ] + "-" +
        HEXOCTETS[ s2 & 0x3f | VARIANT ] +
        HEXOCTETS[ s2 >>> 8 & 0xff ] + "-" +
        HEXOCTETS[ s2 >>> 16 & 0xff ] +
        HEXOCTETS[ s2 >>> 24 & 0xff ] +
        HEXOCTETS[ s3 & 0xff ] +
        HEXOCTETS[ s3 >>> 8 & 0xff ] +
        HEXOCTETS[ s3 >>> 16 & 0xff ] +
        HEXOCTETS[ s3 >>> 24 & 0xff ];

    }

  } )();
  
  static #mainFunction;
  
  static getMainFunction() {

    return this.#mainFunction;

  }
  
  static setMainFunction( main ) {

    if ( main == null ) {

      this.#mainFunction = null;

    } else if ( typeof main == "function" ) {
    
      this.#mainFunction = main;

    } else {

      throw new TypeError();

    }

  }

}

if ( isWorkerThread ) {

  self.addEventListener( "message", async event => {

    const { requestID, message: args } = event.data;

    try {

      const method = PromisedWorker.getMainFunction();
      const result = method == null ? undefined : method( args );
      self.postMessage( { requestID, status: "success", message: result } );
      return;

    } catch ( error ) {

      self.postMessage( { requestID, status: "failure", message: error } );
      throw error;

    }

  } );

}

export { PromisedWorker as default };
