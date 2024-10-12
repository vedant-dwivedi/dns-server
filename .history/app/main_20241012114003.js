const dgram = require("dgram");

// Create DNS Header
function createDNSHeader(buff, realID, answerCount) {
    const header = Buffer.alloc(12);
    header.writeUInt16BE(realID, 0);
    const flags = 0x8180; // QR=1, AA=0, TC=0, RD=1, RA=1, RCODE=0
    header.writeUInt16BE(flags, 2);
    header.writeUInt16BE(1, 4); // QDCOUNT
    header.writeUInt16BE(answerCount, 6); // ANCOUNT
    header.writeUInt16BE(0, 8); // NSCOUNT
    header.writeUInt16BE(0, 10); // ARCOUNT
    return header;
}

// Get Domain Name from Buffer
function getDomainName(buff, offset = 12) {
    let domain = "";
    while (true) {
        const length = buff.readUInt8(offset);
        if (length === 0) break;
        domain += buff.toString("utf-8", offset + 1, offset + 1 + length) + ".";
        offset += length + 1;
    }
    return domain.slice(0, -1); // Remove trailing dot
}

// Create UDP socket
const resolverArgIndex = process.argv.indexOf("--resolver");
let resolverAddress = null;

if (resolverArgIndex !== -1 && process.argv.length > resolverArgIndex + 1) {
    resolverAddress = process.argv[resolverArgIndex + 1];
} else {
    console.log("No resolver address provided. Use --resolver <address>");
    process.exit(1);
}

const [resolverIP, resolverPort] = resolverAddress.split(":");

// Create UDP socket for your DNS server
const udpSocket = dgram.createSocket("udp4");
udpSocket.bind(2053, "127.0.0.1");

// Handle incoming messages
udpSocket.on("message", (buf, rinfo) => {
    const realID = buf.readUInt16BE(0);
    const domain = getDomainName(buf);
    console.log(`Received query for: ${domain}`);

    const resolverSocket = dgram.createSocket("udp4");
    console.log(`Forwarding query to resolver ${resolverIP}:${resolverPort}`);
    resolverSocket.send(buf, resolverPort, resolverIP, (err) => {
        if (err) {
            console.error("Error forwarding query to resolver:", err);
            resolverSocket.close();
            return;
        }
    });

    resolverSocket.on("message", (response) => {
        console.log("Received response from resolver");

        // Get the number of answers from the response
        const answerCount = response.readUInt16BE(6);

        // Create a new header for the response
        const responseHeader = createDNSHeader(response, realID, answerCount);

        // Send the final response back to the client
        const finalResponse = Buffer.concat([responseHeader, response.slice(12)]);
        console.log("Sending response back to client");
        udpSocket.send(finalResponse, rinfo.port, rinfo.address, (err) => {
            if (err) {
                console.error("Error sending response back to client:", err);
            } else {
                console.log("Response sent back to client at:", rinfo.address);
            }
        });
        resolverSocket.close();
    });

    resolverSocket.on("error", (err) => {
        console.error("Resolver socket error:", err);
        resolverSocket.close();
    });
});

// Server listening event
udpSocket.on("listening", () => {
    const address = udpSocket.address();
    console.log(`Server listening on ${address.address}:${address.port}`);
});
