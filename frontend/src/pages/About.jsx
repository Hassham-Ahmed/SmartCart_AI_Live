const techStack = ["React", "Tailwind CSS", "JavaScript", "Flask", "MySQL", "AI Chatbot", "Python", "Gemini API"];

const features = [
  { icon: "🤖", title: "AI Recommendations", text: "Smart algorithms analyze behavior to offer contextual product picks." },
  { icon: "🔒", title: "Secure Shopping", text: "Encrypted authentication and protected checkout workflows." },
  { icon: "⚡", title: "High Performance", text: "Ultra-fast queries and smooth interface rendering." },
];

const team = [
  { name: "👨‍💻 Hassham Ahmed", role: "Full Stack Developer & AI" },
  { name: "👨‍💻 Samiullah", role: "Documentation" },
  { name: "👩‍💻 Sadiya Imam", role: "Database Specialist" },
];

const stats = [
  { value: "900+", label: "Products", color: "text-primary-600" },
  { value: "500+", label: "Customers", color: "text-success-600" },
  { value: "100+", label: "Orders Completed", color: "text-warning-500" },
  { value: "99%", label: "Satisfaction", color: "text-danger-500" },
];

export default function About() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-2">About SmartCart AI</h1>
        <p className="text-gray-500 text-lg">An AI-powered E-Commerce Platform for Next-Gen Smart Shopping</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-10 items-center mb-16">
        <img src="https://picsum.photos/600/400" alt="About SmartCart AI" className="rounded-2xl shadow-lg w-full" />
        <div>
          <h3 className="text-xl font-bold mb-3">Who We Are</h3>
          <p className="text-gray-600 text-lg leading-relaxed">
            SmartCart AI is a cutting-edge e-commerce platform designed to transform online shopping through Artificial Intelligence. Our intelligent engine offers personalized product recommendations, real-time AI assistance, and secure transaction workflows tailored to every customer.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 mb-16">
        <div className="card p-6 border-l-4 border-primary-500">
          <h3 className="text-xl font-bold text-primary-600 mb-2">🎯 Our Mission</h3>
          <p className="text-gray-500">To eliminate traditional shopping friction using Artificial Intelligence, automated recommendations, and intuitive search workflows.</p>
        </div>
        <div className="card p-6 border-l-4 border-success-500">
          <h3 className="text-xl font-bold text-success-600 mb-2">🚀 Our Vision</h3>
          <p className="text-gray-500">To build the ultimate self-learning e-commerce ecosystem providing secure, rapid, and smart online consumer experiences.</p>
        </div>
      </div>

      <div className="card p-8 text-center mb-16">
        <h3 className="text-xl font-bold mb-5">Technologies Powered By</h3>
        <div className="flex flex-wrap justify-center gap-2">
          {techStack.map((t) => (
            <span key={t} className="badge bg-primary-50 text-primary-600">{t}</span>
          ))}
        </div>
      </div>

      <div className="mb-16">
        <h2 className="text-2xl font-bold text-center mb-8">Why Choose SmartCart AI?</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="card card-hover text-center p-6">
              <div className="text-3xl mb-2">{f.icon}</div>
              <h4 className="font-bold mb-1">{f.title}</h4>
              <p className="text-gray-500 text-sm">{f.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-1">Our Project Team</h2>
          <p className="text-gray-500">Meet the engineers behind SmartCart AI</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-6 text-center mb-6">
          {team.map((m) => (
            <div key={m.name} className="card card-hover p-6">
              <h5 className="font-bold mb-1">{m.name}</h5>
              <p className="text-primary-600 font-medium text-sm">{m.role}</p>
            </div>
          ))}
        </div>
        <div className="card bg-gray-50 border-0 p-4 text-center">
          <span className="text-gray-400 text-xs uppercase font-bold">Project Supervisor</span>
          <h5 className="font-bold text-gray-900">Sir Osama Ahmed Khan</h5>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
        {stats.map((s) => (
          <div key={s.label}>
            <h2 className={`text-3xl font-bold mb-0 ${s.color}`}>{s.value}</h2>
            <span className="text-gray-400 text-sm">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
