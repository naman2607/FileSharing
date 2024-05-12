import React from "react";
import { useNavigate } from "react-router-dom";
import "./CreateRoom.css";

const CreateRoom = () => {
  const navigate = useNavigate();

  const create = async (e) => {
    e.preventDefault();

    const resp = await fetch("http://localhost:8084/create");
    const { room_id } = await resp.json();

    navigate(`/room/${room_id}`, { state: { id: room_id } });
  };
  return (
    <div className="Homepage">
      <div className="CreateRoom">
        <button onClick={create}> Create Room</button>
      </div>
      <div className="Instructions">
        <h1>Instructions to share a file :</h1>
        <p>1. Click on create a room</p>
        <p>2. Share the room link</p>
        <p>3. Click on upload file button</p>
      </div>
    </div>
  );
};

export default CreateRoom;
