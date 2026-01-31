import React from 'react'
import { FaSearch, FaEllipsisV } from 'react-icons/fa'

export default function MobileTopBar({ onSearch }) {
  return (
    <div className="md:hidden fixed top-0 left-0 right-0 bg-white/5 backdrop-blur-sm border-b border-white/10 py-2 px-3 z-50">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-full hover:bg-white/10 transition">
            <FaSearch className="text-white text-lg" />
          </button>
          <div className="text-white font-semibold">Search</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-full hover:bg-white/10 transition">Help</button>
          <button className="p-2 rounded-full hover:bg-white/10 transition"><FaEllipsisV className="text-white" /></button>
        </div>
      </div>
    </div>
  )
}
