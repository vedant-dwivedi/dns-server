const dgram = require("dgram");

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

udpSocket.on("message", async (buf, rinfo) => {
  try {
    console.log("Received query from client");
    const header = createDNSHeader(buf);
    const questionCount = buf.readUInt16BE(4); // QDCOUNT

    let questions = [];
    let domains = [];
    for (let i = 0; i < questionCount; i++) {
      const question = getDomainName(buf, offset);
      domains.push(question.domain);
      questions.push(createQuestionSection(question.domain));
      offset = question.newOffset + 4; // Update offset
    }

    // Forward the query to the resolver
    const response = await forwardQueryToResolver(buf, resolverIP, resolverPort);
    
    // Handle the response from the resolver
    handleResolverResponse(response, rinfo, questions);
  } catch (e) {
    console.error(`Error processing query: ${e}`);
  }
});

// Function for forwarding the query
function forwardQueryToResolver(queryBuffer, resolverIP, resolverPort) {
  return new Promise((resolve, reject) => {
    const resolverSocket = dgram.createSocket("udp4");
    resolverSocket.send(queryBuffer, resolverPort, resolverIP, (err) => {
      if (err) {
        reject(err);
        return;
      }
    });

    resolverSocket.on("message", (resolverResponse) => {
      resolve(resolverResponse);
      resolverSocket.close();
    });

    resolverSocket.on("error", (err) => {
      reject(err);
      resolverSocket.close();
    });
  });
}

// Function to handle the response from the resolver
function handleResolverResponse(response, clientInfo, questions) {
  udpSocket.send(response, clientInfo.port, clientInfo.address, (err) => {
    if (err) {
      console.error("Error sending response back to client:", err);
    } else {
      console.log("Response sent back to client at:", clientInfo.address);
    }
  });
}

udpSocket.on("error", (err) => {
  console.log(`Error: ${err}`);
});

udpSocket.on("listening", () => {
  const address = udpSocket.address();
  console.log(`Server listening on ${address.address}:${address.port}`);
});
