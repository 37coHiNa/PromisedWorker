const isWorkerThread = ( typeof WorkerGlobalScope != "undefined" );

class PromisedWorker extends Worker {
  
  #requests = new Map();

  constructor( ...args ) {

    super( ...args );

    this.addEventListener( "message", event => {

      const { requestID, status, index, message } = event.data;

      const request = this.#requests.get( requestID );

      if ( request != null ) {

        const resolve = request.get( index );
        
        if ( resolve != null ) {
          
          resolve( { status, message } );
          
        } else {
          
          request.set( index, { status, message } );
          
        }

      }

    } );

    this.addEventListener( "error", event => {

      console.error( event );

    } );

  }

  async * postMessage( method, ...args ) {
    
    const requestID = this.constructor.#uuidIte.next().value;
    const request = new Map();
    this.#requests.set( requestID, request );
    
    super.postMessage( { requestID, method, args } );

    for ( let index = 0; ; index++ ) {
        
      const { status, message } = await new Promise( resolve => {
        
        if ( request.has( index ) ) {

          resolve( request.get( index ) );

        } else {

          request.set( index, resolve );

        }

      } );
      
      yield message;
      request.delete( index );
      
      if ( status ) {
        
        const status_LowerCase = String( status ).toLowerCase();
        switch ( status_LowerCase ) {
            
          case "":
            continue;
            
          case "success":
            this.#requests.delete( requestID );
            return;
            
          case "failure":
            this.#requests.delete( requestID );
            throw message;
            
          default:
            throw new TypeError( `illegal status: ${ s }` );
            
        }
        
      }
        
    }

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

}

class Request {
  
  static #methods = Object.create( null );
  
  #requestID;
  #method;
  #args;
  #status = "";
  #index = 0;
  
  constructor( { requestID, method, args } ) {
    
    this.#requestID = requestID;
    this.#method = method;
    this.#args = args;
    
  }

  static get methods() { return this.#methods; }

  get method() { return this.#method; }
  
  get args() { return this.#args; }
  
  postMessage( message ) {
    
    const requestID = this.#requestID;
    const status = this.#status;
    const index = this.#index++;
    
    self.postMessage( { requestID, status, index, message } );
    
  }
  
  close() {
    
    if ( this.#status ) return;
    
    this.#status = "success";
    
    this.postMessage();
    
  }
                
  abort( error ) {
    
    if ( this.#status ) return;
    
    this.#status = "failure";
    
    this.postMessage( error );
    
  }

}

const methods = Request.methods;

const WorkerOnMessage = async event => {

  const request = new Request( event.data );

  try {

    let redirect = request.method;

    do {

      const method = methods[ redirect ];
      redirect = await method( request );

    } while ( redirect != null );

    return;

  } catch ( error ) {

    request.abort( error );
    throw error;

  } finally {

    request.close();

  }

};

if ( isWorkerThread ) {
  
  self.addEventListener( "message", WorkerOnMessage );

}

export { PromisedWorker as Worker, Request, methods };
