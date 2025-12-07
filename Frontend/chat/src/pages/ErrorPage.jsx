import { useEffect } from "react";

export default function Torch404() {
  useEffect(() => {
    const handleMove = (e) => {
      const torch = document.getElementById("torch");
      if (torch) {
        torch.style.top = `${e.pageY}px`;
        torch.style.left = `${e.pageX}px`;
      }
    };

    document.addEventListener("mousemove", handleMove);
    return () => document.removeEventListener("mousemove", handleMove);
  }, []);

  return (
    <div
      className="h-screen w-full flex flex-col justify-center items-center overflow-hidden bg-cover bg-left-top"
      style={{
        backgroundImage:
          'url("https://wallpapercave.com/wp/6SLzBEY.jpg")',
      }}
    >
      <div className="text">
        <h1 className="text-[#011718] -mt-52 text-[12rem] md:text-[15rem] font-mono font-bold text-center drop-shadow-[ -5px_5px_0_rgba(0,0,0,0.7), -10px_10px_0_rgba(0,0,0,0.4), -15px_15px_0_rgba(0,0,0,0.2) ]">
          404
        </h1>

        <h2 className="text-black -mt-36 text-5xl md:text-6xl font-mono font-bold text-center drop-shadow-[ -5px_5px_0_rgba(0,0,0,0.7) ]">
          Uh, Ohh
        </h2>

        <h3 className="text-white mt-[-10px] ml-8 text-2xl font-mono font-bold drop-shadow-[ -5px_5px_0_rgba(0,0,0,0.7) ] text-center px-6">
          Sorry we can’t find what you are looking for ’cuz it’s so dark in here
        </h3>
      </div>

      {/* Torch effect */}
      <div
        id="torch"
        className="fixed w-[200px] h-[200px] -mt-40 -ml-40 rounded-full pointer-events-none"
        style={{
          boxShadow: "0 0 0 9999em #000000f7",
          background: "rgba(0,0,0,0.3)",
        }}
      >
        <div
          className="w-full h-full rounded-full"
          style={{
            boxShadow:
              "inset 0 0 40px 2px #000, 0 0 20px 4px rgba(13,13,10,0.2)",
          }}
        ></div>
      </div>
    </div>
  );
}
