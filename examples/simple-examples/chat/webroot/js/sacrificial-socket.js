(function(window){ 'use strict';
	/**
	* SS is the constructor for the sacrificial-socket client
	*
	* @class SS
	* @constructor
	* @param {String} url - The url to the sacrificial-socket server endpoint. The url must conform to the websocket URI Scheme ("ws" or "wss")
	*/
	var SS = function(url){
		var	self                = this,
			ws                  = new WebSocket(url, 'sac-sock'),
			events              = {},
			headerStartCharCode = 1,
			headerStartChar     = String.fromCharCode(headerStartCharCode),
			dataStartCharCode   = 2,
			dataStartChar       = String.fromCharCode(dataStartCharCode);
		
		//sorry, only supporting arraybuffer at this time
		//maybe if there is demand for it, I'll add Blob support
		ws.binaryType = 'arraybuffer';
		
		//Parses all incoming messages and dispatches their payload to the appropriate eventName if one has been registered. Messages received for unregistered events will be ignored.
		ws.onmessage = function(e){
			var msg = e.data,
				headers = {},
				eventName = '',
				data = '',
				chr = null,
				i, msgLen;
			
			if(typeof msg === 'string'){
				var dataStarted = false,
					headerStarted = false;
				
				for(i = 0, msgLen = msg.length; i < msgLen; i++){
					chr = msg[i];
					if(!dataStarted && !headerStarted && chr !== dataStartChar && chr !== headerStartChar){
						eventName += chr;
					}else if(!headerStarted && chr === headerStartChar){
						headerStarted = true;
					}else if(headerStarted && !dataStarted && chr !== dataStartChar){
						headers[chr] = true;
					}else if(!dataStarted && chr === dataStartChar){
						dataStarted = true;
					}else{
						data += chr;
					}
				}
			}else if(msg && msg instanceof ArrayBuffer && msg.byteLength !== undefined){
				var dv = new DataView(msg),
					headersStarted = false;
				
				for(i = 0, msgLen = dv.byteLength; i < msgLen; i++){
					chr = dv.getUint8(i);
					
					if(chr !== dataStartCharCode && chr !== headerStartCharCode && !headersStarted){
						eventName += String.fromCharCode(chr);
					}else if(chr === headerStartCharCode && !headersStarted){
						headersStarted = true;
					}else if(headersStarted && chr !== dataStartCharCode){
						headers[String.fromCharCode(chr)] = true;
					}else if(chr === dataStartCharCode){
						data = dv.buffer.slice(i+1);
						break;
					}
				}
			}
			
			if(eventName.length === 0) return; //no event to dispatch
			if(typeof events[eventName] === 'undefined') return;
			events[eventName]((headers.J) ? JSON.parse(data) : data);
		};
		
		/**
		* onConnect registers a callback to be run when the websocket connection is open.
		* 
		* @method onConnect
		* @param {Function} callback(SS) - The callback that will be executed when the websocket connection opens. 
		*
		*/
		self.onConnect = function(callback){
			ws.onopen = function(){ callback(self); };
		};
		
		/**
		* onDisconnect registers a callback to be run when the websocket connection is closed.
		*
		* @method onDisconnect
		* @param {Function} callback(SS) - The callback that will be executed when the websocket connection is closed.
		*/
		self.onDisconnect = function(callback){
			ws.onclose = function(){ callback(self); };
		};
		
		/**
		* on registers an event to be called when the client receives an emit from the server for
		* the given eventName.
		*
		* @method on
		* @param {String} eventName - The name of the event being registerd
		* @param {Function} callback(payload) - The callback that will be ran whenever the client receives an emit from the server for the given eventName. The payload passed into callback may be of type String, Object, or ArrayBuffer
		*
		*/
		self.on = function(eventName, callback){
			events[eventName] = callback;
		};
		
		/**
		* off unregisters an emit event
		*
		* @method off
		* @param {String} eventName - The name of event being unregistered
		*/
		self.off = function(eventName){
			if(events[eventName]){
				delete events[eventName];
			}
		};
		
		/**
		* emit dispatches an event to the server
		*
		* @method emit
		* @param {String} eventName - The event to dispatch
		* @param {String|Object|ArrayBuffer} data - The data to be sent to the server. If data is a string then it will be sent as a normal string to the server. If data is an object it will be converted to JSON before being sent to the server. If data is an ArrayBuffer then it will be sent to the server as a uint8 binary payload.
		*/
		self.emit = function(eventName, data){
			var rs = ws.readyState;
			if(rs === 0){
				console.warn("websocket is not open yet");
				return;
			}else if(rs === 2 || rs === 3){
				console.error("websocket is closed");
				return;
			}
			var msg = '';
			if(data instanceof ArrayBuffer){
				var ab = new ArrayBuffer(data.byteLength+eventName.length+1),
					newBuf = new DataView(ab),
					oldBuf = new DataView(data),
					i = 0;
				for(var evtLen = eventName.length; i < evtLen; i++){
					newBuf.setUint8(i, eventName.charCodeAt(i));
				}
				newBuf.setUint8(i, dataStartCharCode);
				i++;
				for(var x = 0, xLen = oldBuf.byteLength; x < xLen; x++, i++){
					newBuf.setUint8(i, oldBuf.getUint8(x));
				}
				msg = ab;
			}else if(typeof data === 'object'){
				msg = eventName+dataStartChar+JSON.stringify(data);
			}else{
				msg = eventName+dataStartChar+data;
			}
			ws.send(msg);
		};
		
		/**
		* close will close the websocket connection, calling the "onDisconnect" event if one has been registered.
		*
		* @method close
		*/
		self.close = function(){
			return ws.close();
		};
	};
	
	window.SS = SS;
})(window);