const dgram = require("dgram");
const { builtinModules } = require("module");

function createDNSHeader(buff) {
  const header = Buffer.alloc(12); // DNS header is 12 bytes

  // Packet Identifier (ID) - 16 bits: Set to 1234 (0x04D2 in hex)
  header.writeUInt16BE(buff.readUInt16BE(0), 0);

  // Flags - 16 bits: QR = 1, OPCODE = 0, AA = 0, TC = 0, RD = 0, RA = 0, Z = 0, RCODE = 0
  // QR (1) OPCODE (4) AA (1) TC (1) RD (1) RA (1) Z (3) RCODE (4)
  // 0x8000: QR = 1 (response), everything else = 0 
  // Extract the necessary fields from the incoming buffer
  const opcode = buff.readUInt16BE(2) & 0x7800; // Extract OPCODE bits
  const rd = buff.readUInt16BE(2) & 0x0100; // Extract RD bit
  const rcode = (opcode === 0) ? 0 : 4; // Set RCODE based on OPCODE

  // QR = 1 (response), AA = 0, TC = 0, RA = 0QD
  const flags = 0x8000 | opcode | rd | rcode; // Construct flags with RD included
  header.writeUInt16BE(buff.readUInt16BE(2), 2);

  // QDCOUNT (number of questions) - 16 bits: Set to 0 for this stage
  header.writeUInt16BE(1, 4);

  // ANCOUNT (number of answers) - 16 bits: Set to 0 for this stage
  header.writeUInt16BE(0, 6);

  // NSCOUNT (number of authority records) - 16 bits: Set to 0
  header.writeUInt16BE(0, 8);

  // ARCOUNT (number of additional records) - 16 bits: Set to 0
  header.writeUInt16BE(0, 10);

  return header;
}

function getDomainName(buff,offset = 12) {
  let domain = "";
  let jumped = false;
  let jumpOffset = -1

  // Loop through domain name labels
  while (true) {
    const length = buff.readUInt8(offset);
    // Check for pointer (compression)
    if ((length & 0xC0) === 0xC0) { // First two bits are 11 (indicating a pointer)
      if (!jumped) {
        jumpOffset = offset + 2; // Save where to jump back to after pointer
      }
      const pointer = buff.readUInt16BE(offset) & 0x3FFF; // Mask first 2 bits, get pointer
      offset = pointer; // Jump to pointer location
      jumped = true;
      continue; // Continue parsing at the new offset
    }
      if (offset >= buff.length) { // Check if offset is out of buffer range
        throw new Error("offset out of bounds while parsing domain name");
      }

    if (length === 0) break; // Null byte indicates the end of the domain name

    // Check if length is valid and within buffer bounds
    if (offset + length + 1 > buff.length) {
      throw new Error("Invalid domain name length in buffer");
    }

    domain += buff.toString("utf-8", offset + 1, offset + 1 + length) + ".";
    offset += length + 1;
  }
  
  if (jumped && jumpOffset !== -1) {
    offset = jumpOffset; // If jumped, restore the original offset
  }
  return { domain: domain.slice(0, -1), newOffset: offset + 1 };
}

function getEncodedName(domain) {
  const domainParts = domain.split(".");
  const encodedParts = [];

  domainParts.forEach((part) => {
    const lengthBuffer = Buffer.alloc(1); // Length of each part
    lengthBuffer.writeUInt8(part.length, 0); // Write the length as a single byte
    const nameBuffer = Buffer.from(part, "utf-8"); // Write the part itself
    encodedParts.push(lengthBuffer, nameBuffer);
  });

  // Push the final null byte
  encodedParts.push(Buffer.from([0x00]));

  return Buffer.concat(encodedParts); // Return the concatenated buffer
}

function createQuestionSection(domain) {
  // Encode the domain name codecrafters.io

  // Type (A record) - 2 bytes, big-endian
  const type = Buffer.alloc(2);
  type.writeUInt16BE(1, 0); // 1 corresponds to an A record

  // Class (IN) - 2 bytes, big-endian
  const classField = Buffer.alloc(2);
  classField.writeUInt16BE(1, 0); // 1 corresponds to IN (Internet class)

  // Concatenate all parts
  const name = getEncodedName(domain)
  return Buffer.concat([name, type, classField]);
}

function createAnswerSection(buff,domain){

  const name = getEncodedName(domain)

  // Type (A record) - 2 bytes, big-endian
  const type = Buffer.alloc(2);
  type.writeUInt16BE(buff.readUInt16BE(0), 0); // 1 corresponds to an A record

  // Class (IN) - 2 bytes, big-endian
  const classField = Buffer.alloc(2);
  classField.writeUInt16BE(buff.readUInt16BE(2), 0); // 1 corresponds to IN (Internet class)

  // TTL (Time to live) - 4 bytes, big-endian
  const ttl = Buffer.alloc(4);
  ttl.writeUInt32BE(buff.readUInt32BE(4), 0); // TTL of 60 seconds

  // RDLENGTH (length of RDATA) - 2 bytes, big-endian
  const rdlength = Buffer.alloc(2);
  rdlength.writeUInt16BE(buff.readUInt16BE(8), 0); // 4 bytes for the IPv4 address

  // RDATA (IPv4 address) - 4 bytes, big-endian
  const rdata = Buffer.from(buff.readUInt32BE(10)); // Example IP address (8.8.8.8)

  // Concatenate all parts
  return Buffer.concat([name, type, classField, ttl, rdlength, rdata]);
}

// let resolverArgIndex = process.argv.indexOf("--resolver");
// let resolverAdress = null
// if(resolverArgIndex !== -1 && process.argv.length > resolverArgIndex + 1)
// {
//   resolverAdress = process.argv[resolverArgIndex + 1]
//   console.log(resolverAdress)
// }else {
//   console.log("No resolver address provided. Use --resolver <address>");
//   process.exit(1);
// }

// const [resolverIPAdress,resolverPort] = resolverAdress.split(":")

// const udpSocket = dgram.createSocket("udp4");
// udpSocket.bind(2053, "127.0.0.1");

// function queryToResolver(queryBuffer, resolverIP, resolverPort, clientInfo)
// {
//   // Define resolverSocket inside this function
//   const resolverSocket = dgram.createSocket("udp4");

//   // Send the query to the resolver (e.g., Google DNS at 8.8.8.8)
//   resolverSocket.send(queryBuffer, resolverPort, resolverIP, (err) => {
//     if (err) {
//       console.error("Error forwarding query to resolver:", err);
//     }
//   });

//   // Listen for the response from the resolver
//   resolverSocket.on("message", (resolverResponse) => {
//     console.log("Received response from resolver");

//     // Send the response back to the client
//     handleResolverResponse(resolverResponse, clientInfo);

//     // Close resolver socket after forwarding
//     resolverSocket.close();
//   });

//   resolverSocket.on("error", (err) => {
//     console.error(`Resolver socket error: ${err}`);
//   });
// }

// function handleResolverResponse(buf,clientInfo){
//   udpSocket.send(buf,clientInfo.port,clientInfo.address, (err) => {
//     if (err) {
//       console.error("Error sending response back to client:", err);
//     } else {
//       const header = createDNSHeader(buf)
//       let offset = 12; // DNS header ends at byte 12
//       const questionCount = buf.readUInt16BE(4); // QDCOUNT
  
//       let questions = [];
//       for (let i = 0; i < questionCount; i++) {
//         const question = getDomainName(buf, offset);
//         console.log(question)
//         questions.push(question.domain);
//         offset = question.newOffset + 4; // Update offset after reading each question
//       }
//       console.log(questions)
//       const questionSection = Buffer.concat(
//         questions.map(domain => createQuestionSection(domain))
//       );
  
//       const answerSection = Buffer.concat(
//         questions.map(domain => createAnswerSection(domain))
//       );
  
//       const response = Buffer.concat([header, questionSection, answerSection]);
//       udpSocket.send(response, rinfo.port, rinfo.address);
//     }
//   })
// }

// udpSocket.on("message", (buf, rinfo) => {
//   try {
//     const header = createDNSHeader(buf)
//     let offset = 12; // DNS header ends at byte 12
//     const questionCount = buf.readUInt16BE(4); // QDCOUNT

//     let questions = [];
//     for (let i = 0; i < questionCount; i++) {
//       const question = getDomainName(buf, offset);
//       console.log(question)
//       questions.push(question.domain);
//       offset = question.newOffset + 4; // Update offset after reading each question
//     }
//     console.log(questions)
//     const questionSection = Buffer.concat(
//       questions.map(domain => createQuestionSection(domain))
//     );

//     const answerSection = Buffer.concat(
//       questions.map(domain => createAnswerSection(domain))
//     );

//     const response = Buffer.concat([header, questionSection, answerSection]);
//     resolverSocket.send(response, rinfo.port, rinfo.address);
//   } catch (e) {
//     console.log(`Error receiving data: ${e}`);
//   }
// });

// resolverSocket.on("message", (buf,rinfo)=>{
//   try {
//     queryToResolver(buf,resolverIPAdress,resolverPort,rinfo)
//     // const header = createDNSHeader(buf)
//     // let offset = 12; // DNS header ends at byte 12
//     // const questionCount = buf.readUInt16BE(4); // QDCOUNT

//     // let questions = [];
//     // for (let i = 0; i < questionCount; i++) {
//     //   const question = getDomainName(buf, offset);
//     //   console.log(question)
//     //   questions.push(question.domain);
//     //   offset = question.newOffset + 4; // Update offset after reading each question
//     // }
//     // console.log(questions)
//     // const questionSection = Buffer.concat(
//     //   questions.map(domain => createQuestionSection(domain))
//     // );

//     // const answerSection = Buffer.concat(
//     //   questions.map(domain => createAnswerSection(domain))
//     // );

//     // const response = Buffer.concat([header, questionSection, answerSection]);
//     // udpSocket.send(response, rinfo.port, rinfo.address);

//   } catch (e) {
//     console.log(`Error receiving data: ${e}`);
//   }
// })

// udpSocket.on("error", (err) => {
//   console.log(`Error: ${err}`);
// });

// udpSocket.on("listening", () => {
//   const address = udpSocket.address();
//   console.log(`Server listening ${address.address}:${address.port}`);
// });

const resolverArgIndex = process.argv.indexOf("--resolver");
let resolverAddress = null;
if (resolverArgIndex !== -1 && process.argv.length > resolverArgIndex + 1) {
  resolverAddress = process.argv[resolverArgIndex + 1];
} else {
  console.log("No resolver address provided. Use --resolver <address>");
  process.exit(1);
}

const [resolverIP, resolverPort] = resolverAddress.split(":");
let answers = []
let responseHeader

// Create UDP socket for your DNS server
const udpSocket = dgram.createSocket("udp4");
udpSocket.bind(2053, "127.0.0.1");

udpSocket.on("message", async (buf, rinfo) => {
  try {
    console.log("Received query from client");
    let realID;
    let questions = [];
    let domains = [];
    let answers = [];
    let responseHeader
    const header = createDNSHeader(buf);
    let offset = 12; // DNS header ends at byte 12
    const questionCount = buf.readUInt16BE(4); // QDCOUNT
    if(questionCount>1){
      realID = buf.readInt16BE(0);
      for (let i = 0; i < questionCount; i++) {
        const question = getDomainName(buf, offset);
        
        // Update the Transaction ID with a random value
        buf.writeInt16BE(Math.floor(1000 + Math.random() * 9000), 0);
        
        const questionSection = createQuestionSection(question.domain);
        const response = Buffer.concat([header, questionSection]);
        console.log(response.toString('hex'));
  
        // Wait for the resolver's response
        const { header: resolverHeader, answer: resolverAnswer } = await forwardQueryToResolver(response, resolverIP, resolverPort);
        responseHeader = resolverHeader
        // Process the resolver response here
        answers.push(resolverAnswer);
        
        domains.push(question.domain);
        questions.push(questionSection);
        offset = question.newOffset + 4; // Update offset after reading each question
      }
  
      // Handle the final resolver response after processing all questions
      handleResolverResponse(answers, rinfo, questions, realID, responseHeader);
    }
    else{
      const resolverSocket = dgram.createSocket("udp4");
      resolverSocket.send(buf,resolverPort,resolverIP,(err)=>{
        if (err) {
          console.error("Error forwarding query to resolver:", err);
          reject(err); // Reject the promise if there is an error sending the query
          resolverSocket.close(); // Close the socket on error
          return;
        }
      })
      resolverSocket.on('message',(response)=>{
        udpSocket.send(response,rinfo.port,rinfo.address, (err) => {
          if (err) {
            console.error("Error sending response back to client:", err);
          } else {
            console.log("Response sent back to client at:", rinfo.address); 
          }})
        resolverSocket.close()
      })
      resolverSocket.on("error", (err) => {
        console.error("Socket error:", err);
        reject(err); // Reject the promise on socket error
        resolverSocket.close(); // Close the socket on error
      });
    }
  
  } catch (e) {
    console.error(`Error processing query: ${e}`);
  }
});

function forwardQueryToResolver(queryBuffer, resolverIP, resolverPort) {
  return new Promise((resolve, reject) => {
    const resolverSocket = dgram.createSocket("udp4");

    // Send the entire query (including multiple questions) to the external resolver
    resolverSocket.send(queryBuffer, resolverPort, resolverIP, (err) => {
      if (err) {
        console.error("Error forwarding query to resolver:", err);
        reject(err); // Reject the promise if there is an error sending the query
        resolverSocket.close(); // Close the socket on error
        return;
      }
    });

    resolverSocket.on("message", (resolverResponse) => {
      console.log("Received response from resolver");
      
      const dnsResponse = Buffer.from(resolverResponse.toString('hex'), 'hex');

      // DNS Header is 12 bytes
      const headerLength = 12;

      // Extract the header section
      const headerSection = dnsResponse.slice(0, headerLength);

      // Calculate the length of the question section
      const questionLength = dnsResponse.indexOf(0x00, headerLength) - headerLength + 5; // +5 for the null byte + QTYPE + QCLASS

      // Answer section starts after the question
      const answerOffset = headerLength + questionLength;

      // Extract the answer section
      const answerSection = dnsResponse.slice(answerOffset);

      resolverSocket.close(); // Close the socket after receiving the response
      
      // Resolve the promise with both the header and answer sections
      resolve({ header: headerSection, answer: answerSection });
    });

    resolverSocket.on("error", (err) => {
      console.error("Socket error:", err);
      reject(err); // Reject the promise on socket error
      resolverSocket.close(); // Close the socket on error
    });
  });
}

function handleResolverResponse( answers, clientInfo, questions, realID, header) {
  // Forward the resolver's response back to the original client
  let section = []
  header.writeInt16BE(realID,0)
  header.writeInt16BE(questions.length,4)
  header.writeInt16BE(answers.length,6)
  section.push(header)
  for(i=0;i<questions.length;i++)
  {
    section.push(questions[i])
  }
  for(i=0;i<answers.length;i++)
  {
    section.push(answers[i])
  }
  finalresponse = Buffer.concat(section)
  console.log("finalresponse",Buffer.concat(section).toString('hex'))
  udpSocket.send(finalresponse, clientInfo.port, clientInfo.address, (err) => {
    if (err) {
      console.error("Error sending response back to client:", err);
    } else {
      console.log("Response sent back to client at:", clientInfo.address); 
    }
  });
  section = [null]
}

udpSocket.on("error", (err) => {
  console.log(`Error: ${err}`);
});

udpSocket.on("listening", () => {
  const address = udpSocket.address();
  console.log(`Server listening on ${address.address}:${address.port}`);
});