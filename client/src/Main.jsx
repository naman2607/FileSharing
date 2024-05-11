import {BrowserRouter, Route, Routes, } from "react-router-dom";

import CreateRoom from './components/CreateRoom.tsx';
import Room from "./components/Room.tsx";

function Main() {
  

  return (
    <div className="Main">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<CreateRoom />}></Route>
          <Route path="/room/:roomID" element={<Room/>}></Route>
        </Routes>
      </BrowserRouter>
    </div>
  )
} 

export default Main