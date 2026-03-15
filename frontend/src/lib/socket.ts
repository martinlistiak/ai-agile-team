import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      path: '/socket.io',
      autoConnect: false,
      auth: {
        token: localStorage.getItem('token'),
      },
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
