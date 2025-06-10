// MindMapApp.jsx – Dynamic Zoomable Mind-Map (Left-to-Right Vertical Flow)
// ----------------------------------------------------------------------
// • Root on the left, branches grow to the right (classic flow-chart).
// • Scroll wheel  → zoom (0.3 × – 2 ×).
// • Mouse-drag    → pan the whole map.
// • Nodes never overlap (nodeSize spacing) and the tree recentres on
//   every expand / collapse / window-resize.
// • 450 ms cubic-Bézier transitions for a polished feel.
// ----------------------------------------------------------------------

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import dataGeneral from "./data.json";
import dataFastest from "./data_fastest.json";

export default function MindMapApp() {
  const svgRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [roadmapType, setRoadmapType] = useState("general");
  const [showBlink, setShowBlink] = useState(true);
  useEffect(() => {
    if (!showBlink) return;
    const timer = setTimeout(() => setShowBlink(false), 7000);
    return () => clearTimeout(timer);
  }, [showBlink]);
  const data = roadmapType === "fastest" ? dataFastest : dataGeneral;

  useEffect(() => {
    let width, height, root, tree, id = 0;
    // Remove all children from SVG before re-rendering to prevent ghost nodes
    if (svgRef.current) {
      while (svgRef.current.firstChild) {
        svgRef.current.removeChild(svgRef.current.firstChild);
      }
    }
    const svg = d3.select(svgRef.current)
      .style("font-family", "JetBrains Mono, Fira Mono, Menlo, monospace")
      .style("font-size", "15px")
      .call(
        d3.zoom()
          .scaleExtent([0.3, 2])
          .on("zoom", e => zoomG.attr("transform", e.transform))
      )
      .on("dblclick.zoom", null);

    const zoomG   = svg.append("g");
    const layoutG = zoomG.append("g");

    svg.append("defs").append("filter")
      .attr("id", "shadow").attr("x", "-20%")
      .attr("y", "-20%")
      .attr("width", "140%")
      .attr("height", "140%")
      .append("feDropShadow")
      .attr("dx", 0).attr("dy", 2).attr("stdDeviation", 2).attr("flood-color", darkMode ? "#39ff14aa" : "#00000025");

    root = d3.hierarchy(data);
    root.x0 = 0; root.y0 = 0;
    root.children?.forEach(collapse);

    function resize() {
      width  = window.innerWidth;
      height = window.innerHeight;
      svg.attr("viewBox", `0 0 ${width} ${height}`);
      tree = d3.tree().nodeSize([90, 240]);
      update(root);
      setLoaded(true);
    }
    window.addEventListener("resize", resize);
    resize();

    function update(source) {
      const nodes = tree(root).descendants();
      const links = nodes.slice(1);
      nodes.forEach(d => {
        d.y = d.x;
        d.x = d.depth * 260 + 120;
        d.y0 = d.y0 ?? d.y;
      });
      const [minY, maxY] = d3.extent(nodes, d => d.y);
      const offsetY = height / 2 - (minY + maxY) / 2;
      layoutG.attr("transform", `translate(80, ${offsetY})`);

      const nodeSel = layoutG.selectAll("g.node").data(nodes, d => d.id || (d.id = ++id));
      const nodeEnter = nodeSel.enter().append("g")
        .attr("class", "node")
        .attr("transform", () => `translate(${source.x0},${source.y0})`)
        .style("cursor", "pointer")
        .on("click", (_, d) => {
          d.children
            ? (d._children = d.children, d.children = null)
            : (d.children = d._children, d._children = null);
          update(d);
        })
        .on("mouseenter", function(_, d) {
          setHovered({ name: d.data.name, description: d.data.description });
        })
        .on("mouseleave", function() {
          setHovered(null);
        });

      // --- Dynamic sizing and centering for multi-line text ---
      nodeEnter.each(function(d) {
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.visibility = 'hidden';
        tempDiv.style.font = '15px JetBrains Mono, Fira Mono, Menlo, monospace';
        tempDiv.style.whiteSpace = 'pre-line';
        tempDiv.style.padding = '0 20px';
        tempDiv.style.width = 'auto';
        tempDiv.style.display = 'inline-block';
        tempDiv.style.lineHeight = '1.5';
        tempDiv.style.textAlign = 'center';
        tempDiv.innerText = d.data.name;
        document.body.appendChild(tempDiv);
        d.textWidth = Math.max(tempDiv.offsetWidth, 130);
        d.textHeight = Math.max(tempDiv.offsetHeight, 48);
        document.body.removeChild(tempDiv);
      });

      nodeEnter.append("rect")
        .attr("width", d => d.textWidth)
        .attr("height", d => d.textHeight)
        .attr("x", d => -0.5 * d.textWidth)
        .attr("y", d => -0.5 * d.textHeight)
        .attr("rx", 12).attr("ry", 12)
        .attr("fill", darkMode ? "#0a0a0a" : "#fff")
        .attr("stroke-width", 2.5)
        .attr("stroke", darkMode ? "#39ff14" : (d => d._children ? "#2563eb" : "#cbd5e1"))
        .attr("filter", "url(#shadow)");

      nodeEnter.append("foreignObject")
        .attr("x", d => -0.5 * d.textWidth)
        .attr("y", d => -0.5 * d.textHeight)
        .attr("width", d => d.textWidth)
        .attr("height", d => d.textHeight)
        .append("xhtml:div")
        .style("display", "flex")
        .style("align-items", "center")
        .style("justify-content", "center")
        .style("height", "100%")
        .style("width", "100%")
        .style("white-space", "pre-line")
        .style("font", "15px JetBrains Mono, Fira Mono, Menlo, monospace")
        .style("text-align", "center")
        .style("color", darkMode ? "#39ff14" : "#0f172a")
        .text(d => d.data.name);

      nodeEnter.select("text").remove();

      const nodeUpdate = nodeEnter.merge(nodeSel);
      nodeUpdate.transition().duration(500)
        .attr("transform", d => `translate(${d.x},${d.y})`);
      nodeUpdate.select("rect")
        .attr("stroke", darkMode ? "#39ff14" : (d => d._children ? "#2563eb" : "#cbd5e1"));
      nodeSel.exit().transition().duration(350)
        .attr("transform", () => `translate(${source.x},${source.y})`)
        .remove();

      const linkSel = layoutG.selectAll("path.link").data(links, d => d.id);
      const linkEnter = linkSel.enter().insert("path", "g")
        .attr("class", "link")
        .attr("fill", "none")
        .attr("stroke", darkMode ? "#39ff14" : "#d1d5db")
        .attr("stroke-width", 2.1)
        .attr("d", () => curved({ source: {x: source.x0, y: source.y0}, target: {x: source.x0, y: source.y0} }));
      linkEnter.merge(linkSel).transition().duration(500)
        .attr("d", d => curved({ source: d.parent, target: d }))
        .attr("stroke", darkMode ? "#39ff14" : "#d1d5db");
      linkSel.exit().transition().duration(350)
        .attr("d", () => curved({ source: {x: source.x, y: source.y}, target: {x: source.x, y: source.y} }))
        .remove();
      nodes.forEach(d => { d.x0 = d.x; d.y0 = d.y; });
    }
    function curved({ source, target }) {
      const midX = (source.x + target.x) / 2;
      return `M${source.x},${source.y}C${midX},${source.y} ${midX},${target.y} ${target.x},${target.y}`;
    }
    function collapse(node) {
      if (node.children) {
        node._children = node.children;
        node._children.forEach(collapse);
        node.children = null;
      }
    }
    return () => window.removeEventListener("resize", resize);
  }, [darkMode, roadmapType]);

  return (
    <div style={{ width: "100%", height: "100vh", background: darkMode ? "#000" : "#f8fafc", position: "relative" }}>
      <button
        onClick={() => setDarkMode(dm => !dm)}
        style={{
          position: "absolute",
          top: 22,
          left: 22,
          zIndex: 20,
          background: darkMode ? "#0a0a0a" : "#fff",
          color: darkMode ? "#39ff14" : "#2563eb",
          border: `2.5px solid ${darkMode ? '#39ff14' : '#2563eb'}`,
          borderRadius: 10,
          padding: "10px 22px",
          fontWeight: 700,
          fontSize: 16,
          letterSpacing: 1,
          cursor: "pointer",
          boxShadow: darkMode ? "0 2px 16px #39ff1422" : "0 2px 16px #2563eb22",
          transition: "all 0.2s"
        }}
      >
        {darkMode ? 'Light Mode' : 'Dark Mode'}
      </button>
      <button
        onClick={() => setRoadmapType(t => t === "general" ? "fastest" : "general")}
        style={{
          position: "absolute",
          top: 22,
          left: 170,
          zIndex: 20,
          background: darkMode ? "#0a0a0a" : "#fff",
          color: darkMode ? "#39ff14" : "#2563eb",
          border: `2.5px solid ${darkMode ? '#39ff14' : '#2563eb'}`,
          borderRadius: 10,
          padding: "10px 22px",
          fontWeight: 700,
          fontSize: 16,
          letterSpacing: 1,
          cursor: "pointer",
          marginLeft: 12,
          boxShadow: darkMode ? "0 2px 16px #39ff1422" : "0 2px 16px #2563eb22",
          transition: "all 0.2s"
        }}
      >
        {roadmapType === "general" ? 'Fastest Way' : 'General Way'}
      </button>
      {showBlink && (
        <span style={{ position: 'absolute', top: 22, left: 370, zIndex: 21, pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
          <span style={{
            display: 'inline-block',
            fontSize: 32,
            color: darkMode ? '#39ff14' : '#2563eb',
            animation: 'arrow-bounce 0.7s linear infinite alternate',
            marginLeft: 8
          }}>
            ←
          </span>
          <div style={{
            background: darkMode ? "#0a0a0a" : "#fff",
            color: darkMode ? "#39ff14" : "#2563eb",
            border: `2px solid ${darkMode ? '#39ff14' : '#2563eb'}`,
            borderRadius: 10,
            padding: "10px 22px",
            fontWeight: 600,
            fontSize: 15,
            letterSpacing: 0.5,
            boxShadow: darkMode ? "0 2px 16px #39ff1422" : "0 2px 16px #2563eb22",
            maxWidth: 420,
            textAlign: "center",
            marginLeft: 10
          }}>
            Want to learn Application Security the <span style={{fontWeight:700}}>fastest way</span>? Click the <span style={{fontWeight:700}}>'Fastest Way'</span> button.
          </div>
        </span>
      )}
      <style>{`
        @keyframes blink {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
        @keyframes arrow-bounce {
          0% { transform: translateX(0); }
          100% { transform: translateX(-12px); }
        }
      `}</style>
      <svg
        ref={svgRef}
        style={{ width: "100%", height: "100vh", background: darkMode ? "#000" : "#f8fafc", opacity: loaded ? 1 : 0, transition: "opacity 0.7s" }}
      />
      {hovered && hovered.description && (
        <div style={{
          position: "absolute",
          top: 48,
          right: 48,
          minWidth: 280,
          maxWidth: 380,
          background: darkMode ? "#0a0a0a" : "#fff",
          border: `2.5px solid ${darkMode ? '#39ff14' : '#2563eb'}`,
          borderRadius: 14,
          boxShadow: darkMode ? "0 4px 32px #39ff1422" : "0 4px 32px #2563eb22",
          padding: "22px 28px",
          zIndex: 10,
          color: darkMode ? "#39ff14" : "#0f172a",
          fontSize: 17,
          fontWeight: 500,
          pointerEvents: "none",
          transition: "opacity 0.3s"
        }}>
          <div style={{fontWeight: 700, marginBottom: 8, fontSize: 19}}>{hovered.name}</div>
          <div>{hovered.description}</div>
        </div>
      )}
    </div>
  );
}
