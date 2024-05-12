import React from "react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import "./Room.css";
let fileToSend: File
let dataChannel: RTCDataChannel;
let fileDetails = {
  filetype : null,
  filename: null
}
const Room = () => {
  const location = useLocation();
  const peerRef = useRef<RTCPeerConnection>();
  const WebSocketRef = useRef<WebSocket>();
  const [allowUpload, setAllowUpload] = useState<boolean>(false);
  let receivedData = [];

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
      if(message.filetype){
        fileDetails = {
          filename:message.filename,
          filetype:message.filetype
        }
        WebSocketRef.current?.send(JSON.stringify({readytosend:true}))
      }
      if(message.readytosend){
        sendFile(fileToSend);
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
      ],
    });

    const dc = peer.createDataChannel("file-transfer");
    dc.binaryType = "arraybuffer";
    dc.onopen = (e) => {
      console.log("Data channel is opened");
      if(dc.readyState === "open")
         setAllowUpload(true)
      // sendFile();
    };

    dc.onmessage = (e) => {
      console.log("Data channel message", e);
    };


    peer.ondatachannel = (event) => {
      console.log("Data channel created by local peer");
      const dc = event.channel;
      dc.binaryType = "arraybuffer";

      dc.onmessage = (event) => {
        const fileData = event.data;
        if(fileData === "FileTransferComplete"){
          console.log("File transfer complete");
          saveFile();
        }
        else receivedData.push(fileData)
      };
    };

    dataChannel = dc;
    peer.onnegotiationneeded = handleNegotiationNeeded;
    peer.onicecandidate = handleIceCandidateEvent;
    peer.onicecandidateerror = (e) => {
      console.log("Error in ice candidate ", e);
    };

    return peer;
  };

  const saveFile = () => {

    const blob = new Blob(receivedData, { type: fileDetails.filetype?fileDetails.filetype:"application/txt"});
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = fileDetails.filename?fileDetails.filename:"received_file"; 
    link.click();

    // URL.revokeObjectURL(url);
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
      const dc = event.channel;
      dc.binaryType = "arraybuffer";

      dc.onmessage = (event) => {
        const fileData = event.data;
        if(fileData === "FileTransferComplete"){
          console.log("File transfer complete");
          saveFile();
        }
        else receivedData.push(fileData)
      };
    };

    WebSocketRef.current?.send(
      JSON.stringify({ answer: peerRef.current.localDescription })
    );
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];
    if (file) {
      WebSocketRef.current?.send(
        JSON.stringify({filename:file.name, filetype:file.type})
      )
      fileToSend = file
    }
  };
  const sendFile = (tempfile: any) => {
    if (tempfile && dataChannel && dataChannel.readyState === "open") {
      const chunkSize = 8 * 1024;
      console.log("sending file");
      const reader = new FileReader();
      reader.onload = () => {
        const arrayBuffer = reader.result as ArrayBuffer;

        let offset = 0;
      if(arrayBuffer.byteLength < chunkSize){
        dataChannel.send(arrayBuffer)
        return;
      }

      while (offset < arrayBuffer.byteLength) {
        const chunk = arrayBuffer.slice(offset, offset + chunkSize);
        console.log(chunk)
        dataChannel.send(chunk);
        offset += chunkSize;
      }


        dataChannel.send("FileTransferComplete");
      };
      reader.readAsArrayBuffer(tempfile);
    }
  };

  const getUploadFileUI = () => {
    if (allowUpload) {
      return (
        <>
          <span className="drop-title">Drop files here</span>
          or
          <input
            type="file"
            id="images"
            onChange={(e) => handleFileChange(e)}
            required
          />
        </>
      );
    } else return <div className="DefaultMsg">Wait for others to join room ....</div>;
  };
  return (
    <div className="Room">
      <label className="drop-container" id="dropcontainer">
        {getUploadFileUI()}
      </label>
    </div>
  );
};

export default Room;
