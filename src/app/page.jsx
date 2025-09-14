"use client";
import React from "react";
import { Database, MessageCircle, ScanText, Leaf, ArrowRight, Bot } from "lucide-react";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="py-2 px-6">
        <div className="max-w-4xl mx-auto flex justify-center">
          <div className="bg-white rounded-2xl shadow-lg p-4 hover:shadow-xl transition-shadow duration-300">
            <img
              src="/image.png"
              alt="Deliverit Logo"
              className="h-16 w-auto object-contain"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Section */}
          {/* Service Cards */}
          <div className="grid md:grid-cols-3 gap-8 mb-5">
            {/* DIT Card */}
            <div className="group">
              <a
                href="https://dit.trackode.in"
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <div className="bg-white rounded-3xl shadow-lg p-8 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border border-gray-100">
                  <div className="bg-blue-100 rounded-2xl p-4 w-fit mx-auto mb-6 group-hover:bg-blue-200 transition-colors">
                    <Bot className="w-8 h-8 text-blue-600" />
                  </div>
                  
                  <div className="flex items-center justify-center text-blue-600 font-semibold group-hover:text-blue-700">
                    <span>Advanced Chat Bot</span>
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </a>
            </div>

            {/* Chat Card */}
            <div className="group">
              <a
                href="/chatbot"
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <div className="bg-white rounded-3xl shadow-lg p-8 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border border-gray-100">
                  <div className="bg-green-100 rounded-2xl p-4 w-fit mx-auto mb-6 group-hover:bg-green-200 transition-colors">
                    <MessageCircle className="w-8 h-8 text-green-600" />
                  </div>
                  
                  <div className="flex items-center justify-center text-green-600 font-semibold group-hover:text-green-700">
                    <span>Start Chat</span>
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </a>
            </div>

            {/* OCR Card */}
            <div className="group">
              <a
                href="https://ocr.trackode.in"
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <div className="bg-white rounded-3xl shadow-lg p-8 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border border-gray-100">
                  <div className="bg-purple-100 rounded-2xl p-4 w-fit mx-auto mb-6 group-hover:bg-purple-200 transition-colors">
                    <ScanText className="w-8 h-8 text-purple-600" />
                  </div>
                  <div className="flex items-center justify-center text-purple-600 font-semibold group-hover:text-purple-700">
                    <span>Use OCR</span>
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 px-6 bg-white/50 backdrop-blur-sm border-t border-gray-200 flex-shrink-0 fixed bottom-0 w-full">
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Leaf className="w-4 h-4 text-green-600" />
            <span className="text-gray-700 font-medium">Deliverit by Urban Harvest</span>
          </div>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
            <span className="bg-gray-100 px-2 py-1 rounded-full">Version 1.0</span>
            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium animate-pulse">
              🚧 In Development
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;