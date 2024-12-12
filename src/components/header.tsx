import { Share, Edit, Trash } from "lucide-react";

type HeaderProps = {
  onShare: () => void;
  //onDelete: () => void;
};

export default function Header({ onShare }: HeaderProps) {
  return (
    <div className="w-full bg-black border-b border-gray-700 p-4">
      <div className="max-w-3xl mx-auto flex intems-center justify-between">
        <h1 className="text-xl font-semibold text-white">
          🧠 <i>Perplexis</i>
        </h1>
        <button
          onClick={onShare}
          className=" text-white bg-black px-2 py-1 rounded-lg  hover:bg-slate-800 transition"
        >
          <Share
            className="active:scale-95 transition duration-100 cursor-pointer"
            size={16}
          />
        </button>
      </div>
    </div>
  );
}
