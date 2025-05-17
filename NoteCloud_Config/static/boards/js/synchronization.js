let socket;

async function connectWebSocket() {
  const urlHash = window.location.pathname.split('/')[2];
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  socket = new WebSocket(`${protocol}://${window.location.host}/ws/board/${urlHash}/`);

  socket.onopen = function() {
    console.log('WebSocket connected');
  };

  socket.onmessage = function(event) {
    const command = JSON.parse(event.data);
    applyCommand(command); // Assume applyCommand is globally accessible
  };

  socket.onclose = function() {
    console.log('WebSocket disconnected');
  };

  socket.onerror = function(error) {
    console.error('WebSocket error:', error);
  };

  // Wait for the connection to open
  await new Promise(resolve => {
    socket.onopen = () => {
      console.log('WebSocket connected');
      resolve();
    };
  });
}

async function sendCommand(command) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(command));
  } else {
    throw new Error('WebSocket is not open');
  }
}

async function receiveCommands() {
  // This function is implicitly handled by the onmessage event
  // Return a promise that resolves when initial commands are received
  return new Promise(resolve => {
    socket.onmessage = function(event) {
      const command = JSON.parse(event.data);
      applyCommand(command);
      resolve(); // Resolve after first command, assuming initial batch is sent immediately
    };
  });
}

// Expose functions globally
window.connectWebSocket = connectWebSocket;
window.sendCommand = sendCommand;
window.receiveCommands = receiveCommands;