const dgram = require("dgram");
const { Packet } = require("./packet");
// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");
// Uncomment this block to pass the first stage
const udpSocket = dgram.createSocket("udp4");
udpSocket.bind(2053, "127.0.0.1");
udpSocket.on("message", (buf, rinfo) => {
	try {
		console.log('message');
		// const response = Buffer.from(buf);
		// console.log(response);
		// console.log(response.toString());
		console.log(rinfo.port, rinfo.address);
		const packet = new Packet(
			{
				ID: 1234,
				QR: 1,
				OPCODE: 0,
				AA: 0,
				TC: 0,
				RD: 0,
				RA: 0,
				Z: 0,
				RCODE: 0,
				// QDCOUNT: 0,
				QDCOUNT: 1,
				ANCOUNT: 0,
				NSCOUNT: 0,
				ARCOUNT: 0
			}
		);
		// udpSocket.send(packet.getResponse(), rinfo.port, rinfo.address);
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