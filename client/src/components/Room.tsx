import React from "react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

const Room = () => {
  const location = useLocation();
  const peerRef = useRef<RTCPeerConnection>();
  const WebSocketRef = useRef<WebSocket>();
  const [fileToSend, setFileToSend] = useState<File | null>(null);
  const [dataChannel, setDataChannel] = useState<any>(null);

  useEffect(() => {
    const roomID = location.pathname.split("/");
    WebSocketRef.current = new WebSocket(
      `ws://localhost:8084/join?roomID=${roomID[2]}`
    );

    WebSocketRef.current?.addEventListener("open", () => {
      WebSocketRef.current?.send(JSON.stringify({ join: true }));
    });

    WebSocketRef.current?.addEventListener("message", async (e) => {
      const message = JSON.parse(e.data);
      if (message.join) {
        callUser();
      }
      if (message.offer) {
        handleOffer(message.offer);
      }
      if (message.answer) {
        console.log("Received answer");
        peerRef.current?.setRemoteDescription(
          new RTCSessionDescription(message.answer)
        );
      }
      if (message.iceCandidate) {
        console.log("Receiving and Adding ICE Candidate");
        try {
          await peerRef.current?.addIceCandidate(message.iceCandidate);
        } catch (err) {
          console.log("error ICE CANDIDADE");
        }
      }
    });

    return () => {};
  }, []);

  const createPeer = () => {
    console.log("Creating peer connection");
    const peer = new RTCPeerConnection({
        iceServers: [
            {
              urls: "stun:stun.l.google.com:19302",
            },
          ]
    });

    const dc = peer.createDataChannel("file-transfer");
    dc.binaryType = "arraybuffer"
    dc.onopen = (e) =>{
        console.log("Data channel is opened");
        // sendFile();
    }

    dc.onmessage = (e) => {
        console.log("Data channel message", e);
    }

    peer.ondatachannel = (event) => {
        console.log("Data channel created by local peer");
        const dataChannel = event.channel;
        dataChannel.binaryType = "arraybuffer";
  
        dataChannel.onmessage = (event) => {
          console.log("Received file data", event.data);
          const fileData = event.data;
          saveFile(fileData); // Save the received file data
        };
      };


    setDataChannel(dc);
    peer.onnegotiationneeded = handleNegotiationNeeded;
    peer.onicecandidate = handleIceCandidateEvent;
    peer.onicecandidateerror = (e) => {
        console.log("Error in ice candidate ", e)
    }

    return peer;
  };

  const saveFile = (fileData: ArrayBuffer) => {
    // Convert ArrayBuffer to Blob
    const blob = new Blob([fileData],{ type: 'video/mp4' });

    // Create a temporary URL for the Blob
    const url = URL.createObjectURL(blob);

    // Create a link element to download the file
    const link = document.createElement("a");
    link.href = url;
    link.download = "received_file"; // Set the file name here
    link.click();

    // Clean up by revoking the temporary URL
    URL.revokeObjectURL(url);
  };

  const handleNegotiationNeeded = async () => {
    console.log("Creating Offer");

    try {
      const myOffer = await peerRef.current?.createOffer();
      await peerRef.current?.setLocalDescription(myOffer);

      WebSocketRef.current?.send(
        JSON.stringify({ offer: peerRef.current?.localDescription })
      );
    } catch (err) {}
  };

  const handleIceCandidateEvent = (e) => {
    console.log("Found Ice Candidate");
    if (e.candidate) {
      console.log(e.candidate);
      WebSocketRef.current?.send(JSON.stringify({ iceCandidate: e.candidate }));
    }
  };

  const callUser = () => {
    console.log("calling other users");
    peerRef.current = createPeer();
    console.log("call user peer ", peerRef.current)
    // handleNegotiationNeeded();
  };

  const handleOffer = async (offer: any) => {
    console.log("Received Offer, Creating Answer");
    peerRef.current = createPeer();

    await peerRef.current.setRemoteDescription(
      new RTCSessionDescription(offer)
    );

    const answer = await peerRef.current.createAnswer();
    await peerRef.current.setLocalDescription(answer);

    peerRef.current.ondatachannel = (event) => {
        console.log("Data channel created by remote peer");
        const dataChannel = event.channel;
        dataChannel.binaryType = "arraybuffer";
  
        dataChannel.onmessage = (event) => {
          console.log("Received file data", event.data);
          const fileData = event.data;
          saveFile(fileData); // Save the received file data
        };
      };

    WebSocketRef.current?.send(
      JSON.stringify({ answer: peerRef.current.localDescription })
    );
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];
    if (file) {
      sendFile(file)
    }
  };
  const sendFile = (tempfile : File) => {
    if (tempfile && dataChannel && dataChannel.readyState === "open") {
        console.log("sending file");
      const reader = new FileReader();
      reader.onload = () => {
        const fileData = reader.result as ArrayBuffer;
        dataChannel.send(fileData); 
      };
      reader.readAsArrayBuffer(tempfile);
    }
  };

//   const chunkSize = 65536; 

// const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
//   const file = event.target.files && event.target.files[0];
//   if (file) {
//     sendFileInChunks(file);
//   }
// };

// const sendFileInChunks = (file: File) => {
//   if (dataChannel?.readyState === "open") {
//     const reader = new FileReader();
//     let remaining = file.size;
//     let chunkNumber = 0;

//     reader.onload = (e) => {
//       if (e.target?.result) {
//         const chunk = e.target.result as ArrayBuffer;
//         dataChannel.send(createChunkData(chunkNumber, chunk));
//         remaining -= chunk.byteLength;
//         chunkNumber++;

//         if (remaining > 0) {
//           reader.readAsArrayBuffer(file.slice(chunkNumber * chunkSize, remaining + chunkSize));
//         } else {
//           console.log("File sent completely");
//         }
//       }
//     };

//     reader.readAsArrayBuffer(file.slice(0, chunkSize));
//   } else {
//     console.log("Data channel is not open");
//   }
// };

// const createChunkData = (chunkNumber: number, chunk: ArrayBuffer) => {
//     const buffer = new ArrayBuffer(chunkSize + 1);
//     const view = new DataView(buffer);
//     view.buffer[0] = chunkNumber; 
//     const chunkArray = new Uint8Array(chunk);
//     for (let i = 0; i < chunkArray.length; i++) {
//       view.buffer[i + 1] = chunkArray[i]; 
//     }
//     return buffer;
//   };


  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "200px",
          width: "100%",
        }}
      >
        <h1>Golang {"&"} React</h1>
      </div>

      {/* <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          top: "100px",
          right: "100px",
          borderRadius: "10px",
          overflow: "hidden",
        }}
      ></div> */}

      <div>
      <label>Select a file:</label>
      <input type="file" id="myfile" name="myfile" onChange={(e) => handleFileChange(e)}/>
      </div>
    </div>
  );
};

export default Room;
