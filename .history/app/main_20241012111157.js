const dgram = require("dgram");
const { Packet } = require("./packet");

console.log("Logs from your program will appear here!");

const udpSocket = dgram.createSocket("udp4");
udpSocket.bind(2053, "127.0.0.1");

udpSocket.on("message", (buf, rinfo) => {
    try {
        console.log('Received message from', rinfo.address, rinfo.port);
        
        // Create a packet response
        const packet = new Packet({
            ID: buf.readUInt16BE(0), // Use the ID from the incoming request
            QR: 1, // Response flag
            OPCODE: 0, // Standard query
            AA: 1, // Authoritative Answer
            TC: 0, // Not truncated
            RD: 0, // Recursion desired
            RA: 0, // Recursion available
            Z: 0, // Reserved
            RCODE: 0, // No error
            QDCOUNT: 1, // One question
            ANCOUNT: 0, // No answers
            NSCOUNT: 0, // No authority records
            ARCOUNT: 0 // No additional records
        });

        const response = packet.addQuestion().getResponse();
        udpSocket.send(response, rinfo.port, rinfo.address);
    } catch (e) {
        console.log(`Error receiving data: ${e}`);
    }
});

udpSocket.on("error", (err) => {
    console.log(`Error: ${err}`);
});

udpSocket.on("listening", () => {
    const address = udpSocket.address();
    console.log(`Server listening ${address.address}:${address.port}`);
});
