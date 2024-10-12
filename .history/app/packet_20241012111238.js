class Packet {
    constructor({ ID, QR, OPCODE, AA, TC, RD, RA, Z, RCODE, QDCOUNT, ANCOUNT, NSCOUNT, ARCOUNT }) {
        const bitID = Packet.intToBigEndianBits(ID, 16);
        const bitQR = Packet.intToBigEndianBits(QR, 1);
        const bitOPCODE = Packet.intToBigEndianBits(OPCODE, 4);
        const bitAA = Packet.intToBigEndianBits(AA, 1);
        const bitTC = Packet.intToBigEndianBits(TC, 1);
        const bitRD = Packet.intToBigEndianBits(RD, 1);
        const bitRA = Packet.intToBigEndianBits(RA, 1);
        const bitZ = Packet.intToBigEndianBits(Z, 3);
        const bitRCODE = Packet.intToBigEndianBits(RCODE, 4);
        const bitQDCOUNT = Packet.intToBigEndianBits(QDCOUNT, 16);
        const bitANCOUNT = Packet.intToBigEndianBits(ANCOUNT, 16);
        const bitNSCOUNT = Packet.intToBigEndianBits(NSCOUNT, 16);
        const bitARCOUNT = Packet.intToBigEndianBits(ARCOUNT, 16);
        
        this.header = Packet.bitsToBuffer(
            bitID + bitQR + bitOPCODE + bitAA + bitTC + bitRD + bitRA + bitZ + bitRCODE + 
            bitQDCOUNT + bitANCOUNT + bitNSCOUNT + bitARCOUNT
        );
        this.question = Buffer.alloc(0); // Initialize question as empty buffer
    }

    static bitsToBuffer(bits) {
        const bytes = [];
        for (let i = 0; i < bits.length; i += 8) {
            bytes.push(parseInt(bits.substring(i, i + 8), 2));
        }
        return Buffer.from(bytes);
    }

    static intToBigEndianBits(value, numBits) {
        let bits = '';
        for (let i = numBits - 1; i >= 0; i--) {
            const bit = (value & (1 << i)) ? '1' : '0';
            bits += bit;
        }
        return bits;
    }

    addQuestion() {
        const name = Buffer.from('\x0ccodecrafters\x02io\x00');
        const type = Packet.bitsToBuffer(Packet.intToBigEndianBits(1, 16)); // A record
        const classField = Packet.bitsToBuffer(Packet.intToBigEndianBits(1, 16)); // IN class
        this.question = Buffer.concat([name, type, classField], name.length + 2 + 2);
        return this;
    }

    getResponse() {
        const response = Buffer.concat([this.header, this.question], this.header.length + this.question.length);
        return response;
    }
}

module.exports = { Packet };
