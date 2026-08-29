const fs = require('fs');
const path = 'C:/Users/Equipo/Documents/friki-app/src/pages/spaces/LiveChat.jsx';
let content = fs.readFileSync(path, 'utf8');

// I will just disable isConsecutive completely if a message is a reply, or if the PREVIOUS message was a reply.
// Wait, I can't easily track if the previous message was a reply unless I add a variable.
// Let's modify groupedMessages mapping in LiveChat.jsx:
const mapTarget =         lastUserId = msg.user_id;
        lastTime = msgTime;

        return {;

const mapReplace =         lastUserId = msg.user_id;
        lastTime = msgTime;
        
        // Also don't group if the PREVIOUS message was a reply
        if (hasReply) {
            lastUserId = null; // Force next message to not group with this reply
        }

        return {;

if (content.includes(mapTarget)) {
    content = content.replace(mapTarget, mapReplace);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Fixed grouping logic!');
}
