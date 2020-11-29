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
    
    const requestID = ( Math.random() * 2 ** 53 ).toString( 16 ).padStart( 20, "0" );
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

}

class Request {
  
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

const methods = Object.create( null );
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

if ( typeof WorkerGlobalScope != "undefined" ) {
  
  self.addEventListener( "message", WorkerOnMessage );

}

export { PromisedWorker as Worker, Request, methods };
