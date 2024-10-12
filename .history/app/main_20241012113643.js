const dgram = require("dgram");

// Create DNS Header
function createDNSHeader(buff, realID) {
    const header = Buffer.alloc(12); // DNS header is 12 bytes
    header.writeUInt16BE(realID, 0); // Packet Identifier

    // Flags: QR = 1 (response), opcode = 0, RD = 0, RA = 0, RCODE = 0
    const flags = 0x8180; // QR = 1, RA = 1, RCODE = 0 (No Error)
    header.writeUInt16BE(flags, 2);
    
    // QDCOUNT, ANCOUNT, NSCOUNT, ARCOUNT
    header.writeUInt16BE(1, 4); // QDCOUNT
    header.writeUInt16BE(0, 6); // ANCOUNT
    header.writeUInt16BE(0, 8); // NSCOUNT
    header.writeUInt16BE(0, 10); // ARCOUNT

    return header;
}

// Get Domain Name from Buffer
function getDomainName(buff, offset = 12) {
    let domain = "";
    while (true) {
        const length = buff.readUInt8(offset);
        if (length === 0) break; // End of domain name

        domain += buff.toString("utf-8", offset + 1, offset + 1 + length) + ".";
        offset += length + 1;
    }
    return domain.slice(0, -1); // Remove the trailing dot
}

// Encode Domain Name
function getEncodedName(domain) {
    const domainParts = domain.split(".");
    const encodedParts = [];

    domainParts.forEach((part) => {
        const lengthBuffer = Buffer.alloc(1);
        lengthBuffer.writeUInt8(part.length, 0);
        const nameBuffer = Buffer.from(part, "utf-8");
        encodedParts.push(lengthBuffer, nameBuffer);
    });

    // Push the final null byte
    encodedParts.push(Buffer.from([0x00]));
    return Buffer.concat(encodedParts);
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
    try {
        const realID = buf.readUInt16BE(0); // Get original ID from query
        const domain = getDomainName(buf);
        console.log(`Received query for: ${domain}`);

        // Forward query to resolver
        const resolverSocket = dgram.createSocket("udp4");
        resolverSocket.send(buf, resolverPort, resolverIP, (err) => {
            if (err) {
                console.error("Error forwarding query to resolver:", err);
                resolverSocket.close();
                return;
            }
        });

        resolverSocket.on("message", (response) => {
            console.log("Received response from resolver");

            // Create a new header for the response
            const responseHeader = createDNSHeader(response, realID);
            const finalResponse = Buffer.concat([responseHeader, response.slice(12)]); // Skip the original header

            // Send the final response back to the client
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

    } catch (e) {
        console.error(`Error processing query: ${e}`);
    }
});

// Server listening event
udpSocket.on("listening", () => {
    const address = udpSocket.address();
    console.log(`Server listening on ${address.address}:${address.port}`);
});
