const dgram = require("dgram");

// Create DNS Header
function createDNSHeader(buff) {
    const header = Buffer.alloc(12); // DNS header is 12 bytes
    header.writeUInt16BE(buff.readUInt16BE(0), 0); // Packet Identifier

    // Flags: QR = 1 (response), opcode = 0, RD = 0, RA = 0, RCODE = 0
    const flags = 0x8000; // QR = 1
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

// Create Question Section
function createQuestionSection(domain) {
    const name = getEncodedName(domain);
    const type = Buffer.alloc(2);
    type.writeUInt16BE(1, 0); // A record
    const classField = Buffer.alloc(2);
    classField.writeUInt16BE(1, 0); // IN class

    return Buffer.concat([name, type, classField]);
}

// Create Answer Section (Dummy Example)
function createAnswerSection(domain) {
    const name = getEncodedName(domain);
    const type = Buffer.alloc(2);
    type.writeUInt16BE(1, 0); // A record
    const classField = Buffer.alloc(2);
    classField.writeUInt16BE(1, 0); // IN class
    const ttl = Buffer.alloc(4);
    ttl.writeUInt32BE(60, 0); // TTL
    const rdlength = Buffer.alloc(2);
    rdlength.writeUInt16BE(4, 0); // IPv4 address length
    const rdata = Buffer.from([8, 8, 8, 8]); // Example IP (8.8.8.8)

    return Buffer.concat([name, type, classField, ttl, rdlength, rdata]);
}

// Main function to process queries
const resolverArgIndex = process.argv.indexOf("--resolver");
let resolverAddress = null;

if (resolverArgIndex !== -1 && process.argv.length > resolverArgIndex + 1) {
    resolverAddress = process.argv[resolverArgIndex + 1];
} else {
    console.log("No resolver address provided. Use --resolver <address>");
    process.exit(1);
}

const [resolverIP, resolverPort] = resolverAddress.split(":");

// Create UDP socket
const udpSocket = dgram.createSocket("udp4");
udpSocket.bind(2053, "127.0.0.1");

// Handle incoming messages
udpSocket.on("message", async (buf, rinfo) => {
    try {
        const header = createDNSHeader(buf);
        const questionCount = buf.readUInt16BE(4);
        
        let questions = [];
        for (let i = 0; i < questionCount; i++) {
            const offset = 12 + (i * 5); // Assuming QTYPE and QCLASS are 2 bytes each
            const domain = getDomainName(buf, offset);
            questions.push(domain);
        }

        // Handle the queries (only one question for this example)
        const responseSections = questions.map(domain => createQuestionSection(domain));
        const answerSections = questions.map(domain => createAnswerSection(domain));
        
        const response = Buffer.concat([header, ...responseSections, ...answerSections]);
        udpSocket.send(response, rinfo.port, rinfo.address, (err) => {
            if (err) {
                console.error("Error sending response back to client:", err);
            } else {
                console.log("Response sent back to client at:", rinfo.address);
            }
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
