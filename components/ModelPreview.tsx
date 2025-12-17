
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Node, Link, Theme } from '../types';
import { PlusCircle, Link as LinkIcon, MousePointer2, Trash2, Undo2, Redo2, ArrowLeftRight, Save, FolderOpen, FilePlus, Wand2, Circle, Download, Upload } from 'lucide-react';
import mermaid from 'mermaid';

interface ModelPreviewProps {
    nodes: Node[];
    setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
    links: Link[];
    setLinks: React.Dispatch<React.SetStateAction<Link[]>>;
    theme: Theme;
}

// Maximum history steps
const HISTORY_LIMIT = 20;

const ModelPreview: React.FC<ModelPreviewProps> = ({ nodes, setNodes, links, setLinks, theme }) => {
  const [newNodeLabel, setNewNodeLabel] = useState('');
  const [nodeType, setNodeType] = useState<'latent' | 'observed' | 'error'>('latent');
  const [mermaidSyntax, setMermaidSyntax] = useState('');
  const [viewMode, setViewMode] = useState<'canvas' | 'mermaid'>('canvas');
  const [interactionMode, setInteractionMode] = useState<'move' | 'link'>('move');
  const [linkType, setLinkType] = useState<'directed' | 'covariance'>('directed');
  
  // Interaction State
  const [linkingSourceId, setLinkingSourceId] = useState<string | null>(null);
  const [tempLineEnd, setTempLineEnd] = useState<{x: number, y: number} | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedLinkIndex, setSelectedLinkIndex] = useState<number | null>(null);
  
  // History State
  const [history, setHistory] = useState<{nodes: Node[], links: Link[]}[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoAction = useRef(false);
  
  const mermaidRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDark = theme === 'dark';

  // --- History Management ---
  const saveToHistory = useCallback((newNodes: Node[], newLinks: Link[]) => {
      setHistory(prev => {
          const newHistory = prev.slice(0, historyIndex + 1);
          const entry = { nodes: JSON.parse(JSON.stringify(newNodes)), links: JSON.parse(JSON.stringify(newLinks)) };
          
          if (newHistory.length >= HISTORY_LIMIT) {
              newHistory.shift();
          }
          return [...newHistory, entry];
      });
      setHistoryIndex(prev => Math.min(prev + 1, HISTORY_LIMIT - 1));
  }, [historyIndex]);

  const undo = () => {
      if (historyIndex > 0) {
          isUndoRedoAction.current = true;
          const prevState = history[historyIndex - 1];
          setNodes(JSON.parse(JSON.stringify(prevState.nodes)));
          setLinks(JSON.parse(JSON.stringify(prevState.links)));
          setHistoryIndex(historyIndex - 1);
          setSelectedNodeId(null);
          setSelectedLinkIndex(null);
      }
  };

  const redo = () => {
      if (historyIndex < history.length - 1) {
          isUndoRedoAction.current = true;
          const nextState = history[historyIndex + 1];
          setNodes(JSON.parse(JSON.stringify(nextState.nodes)));
          setLinks(JSON.parse(JSON.stringify(nextState.links)));
          setHistoryIndex(historyIndex + 1);
          setSelectedNodeId(null);
          setSelectedLinkIndex(null);
      }
  };

  useEffect(() => {
     if (history.length === 0 && nodes.length > 0) {
         saveToHistory(nodes, links);
     }
  }, []);

  useEffect(() => {
      if (!isUndoRedoAction.current) {
          if (nodes.length > 0 || links.length > 0) {
            const currentHistory = history[historyIndex];
            if (!currentHistory || JSON.stringify(currentHistory.nodes) !== JSON.stringify(nodes) || JSON.stringify(currentHistory.links) !== JSON.stringify(links)) {
                 saveToHistory(nodes, links);
            }
          }
      }
      isUndoRedoAction.current = false;
  }, [nodes, links, saveToHistory, history, historyIndex]);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: true, theme: isDark ? 'dark' : 'default', securityLevel: 'loose' });
  }, [isDark]);

  // --- Real Save / Load (JSON File) ---
  const handleExportJSON = () => {
      const modelData = {
          version: "1.0",
          timestamp: new Date().toISOString(),
          nodes,
          links
      };
      const blob = new Blob([JSON.stringify(modelData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dr_sem_model_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const json = JSON.parse(event.target?.result as string);
              if (json.nodes && json.links) {
                  if (window.confirm("Importing a file will replace your current canvas. Continue?")) {
                      setNodes(json.nodes);
                      setLinks(json.links);
                      setHistory([{ nodes: json.nodes, links: json.links }]);
                      setHistoryIndex(0);
                  }
              } else {
                  alert("Invalid file format.");
              }
          } catch (err) {
              console.error(err);
              alert("Failed to parse file.");
          }
      };
      reader.readAsText(file);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const createNewModel = () => {
      if (window.confirm("Start a new model? Unsaved changes will be lost.")) {
          setNodes([]);
          setLinks([]);
          setHistory([{ nodes: [], links: [] }]);
          setHistoryIndex(0);
      }
  };

  // --- Auto Layout Logic ---
  const autoLayout = () => {
      const newNodes = nodes.map(n => ({ ...n }));
      const latents = newNodes.filter(n => n.type === 'latent');
      const observed = newNodes.filter(n => n.type === 'observed');
      
      if (latents.length === 0 && observed.length === 0) return;

      const exogenousLatents = latents.filter(l => 
          !links.some(link => link.target === l.id && link.type === 'directed' && latents.some(src => src.id === link.source))
      );
      const endogenousLatents = latents.filter(l => !exogenousLatents.find(ex => ex.id === l.id));

      const canvasPadding = 100;
      const layerGap = 350; 
      const nodeGap = 180;
      const observedGap = 100;

      let currentY = canvasPadding;
      exogenousLatents.forEach((node) => {
          node.x = canvasPadding;
          node.y = currentY;
          currentY += nodeGap;
      });

      const totalExoHeight = exogenousLatents.length * nodeGap;
      const totalEndoHeight = endogenousLatents.length * nodeGap;
      let endoStartY = canvasPadding;
      if (endogenousLatents.length < exogenousLatents.length) {
           endoStartY += (totalExoHeight - totalEndoHeight) / 2;
      }

      endogenousLatents.forEach((node, i) => {
          node.x = canvasPadding + layerGap;
          node.y = endoStartY + (i * nodeGap);
      });

      latents.forEach(latent => {
           const connectedObs = links
            .filter(l => (l.source === latent.id && observed.some(o => o.id === l.target)) || (l.target === latent.id && observed.some(o => o.id === l.source)))
            .map(l => {
                const targetId = l.source === latent.id ? l.target : l.source;
                return observed.find(o => o.id === targetId)!;
            })
            .filter((v, i, a) => v && a.findIndex(t => t.id === v.id) === i);
           
           if (connectedObs.length > 0) {
               const totalWidth = (connectedObs.length - 1) * observedGap;
               const startX = latent.x - (totalWidth / 2);
               
               connectedObs.forEach((obs, i) => {
                   if (obs) {
                       obs.x = startX + (i * observedGap);
                       obs.y = latent.y + 120; 
                   }
               });
           }
      });
      // Move Errors near their targets
      const errors = newNodes.filter(n => n.type === 'error');
      errors.forEach(err => {
          const targetLink = links.find(l => l.source === err.id);
          if (targetLink) {
              const target = newNodes.find(n => n.id === targetLink.target);
              if (target) {
                  err.x = target.x - 50;
                  err.y = target.y;
              }
          }
      });

      setNodes(newNodes);
      saveToHistory(newNodes, links);
  };

  useEffect(() => {
    // Mermaid syntax generation
    let syntax = 'graph LR\n';
    
    if (isDark) {
        syntax += 'classDef latent fill:#1e293b,stroke:#e2e8f0,stroke-width:2px,rx:50,ry:50,color:#fff;\n';
        syntax += 'classDef observed fill:#0f172a,stroke:#06b6d4,stroke-width:1px,rx:0,ry:0,color:#fff;\n';
        syntax += 'classDef error fill:#334155,stroke:#94a3b8,stroke-width:1px,rx:50,ry:50,color:#fff;\n';
    } else {
        syntax += 'classDef latent fill:#fff,stroke:#333,stroke-width:2px,rx:50,ry:50;\n';
        syntax += 'classDef observed fill:#f0f9ff,stroke:#0891b2,stroke-width:1px,rx:0,ry:0;\n';
        syntax += 'classDef error fill:#f1f5f9,stroke:#64748b,stroke-width:1px,rx:50,ry:50;\n';
    }

    nodes.forEach(node => {
        const safeLabel = node.label.replace(/[^a-zA-Z0-9]/g, '_');
        const displayLabel = node.label || node.id;
        let shape = `[${displayLabel}]`;
        if (node.type === 'latent') shape = `((${displayLabel}))`;
        if (node.type === 'error') shape = `((${displayLabel}))`;
        syntax += `${node.id}${shape}:::${node.type}\n`;
    });

    links.forEach(link => {
        const arrow = link.type === 'covariance' ? '<-->' : '-->';
        syntax += `${link.source} ${arrow} ${link.target}\n`;
    });

    setMermaidSyntax(syntax);
  }, [nodes, links, isDark]);

  useEffect(() => {
      if (viewMode === 'mermaid' && mermaidRef.current) {
          mermaid.contentLoaded();
          try {
             mermaid.run({ nodes: [mermaidRef.current] });
          } catch(e) { console.error(e); }
      }
  }, [viewMode, mermaidSyntax]);

  const addNode = (overrideType?: 'latent' | 'observed' | 'error') => {
    const typeToAdd = overrideType || nodeType;
    let label = newNodeLabel;
    
    // Auto-generate error label if empty
    if (typeToAdd === 'error' && !label) {
        const existingErrors = nodes.filter(n => n.type === 'error').length;
        label = `e${existingErrors + 1}`;
    }

    if (!label.trim()) return;

    const newNode: Node = {
      id: `n${Date.now()}`,
      label: label,
      type: typeToAdd,
      x: 100 + Math.random() * 50,
      y: 100 + Math.random() * 50,
    };
    setNodes([...nodes, newNode]);
    if (!overrideType) setNewNodeLabel('');
  };

  const handleNodeClick = (id: string) => {
      if (interactionMode === 'link') {
          if (linkingSourceId === null) {
              setLinkingSourceId(id);
          } else if (linkingSourceId === id) {
              setLinkingSourceId(null);
              setTempLineEnd(null);
          } else {
              if (linkingSourceId !== id) { 
                  const exists = links.some(l => 
                    (l.source === linkingSourceId && l.target === id) || 
                    (l.source === id && l.target === linkingSourceId && linkType === 'covariance')
                  );
                  if (!exists) {
                      setLinks([...links, { source: linkingSourceId, target: id, type: linkType }]);
                  }
              }
              setLinkingSourceId(null);
              setTempLineEnd(null);
          }
      } else {
          setSelectedNodeId(id);
          setSelectedLinkIndex(null);
      }
  };

  const handleLinkClick = (index: number, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedLinkIndex(index);
      setSelectedNodeId(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (interactionMode === 'link' && linkingSourceId) {
          const rect = e.currentTarget.getBoundingClientRect();
          setTempLineEnd({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top
          });
      }
  };

  const handleDeleteSelected = () => {
      if (selectedNodeId) {
          const node = nodes.find(n => n.id === selectedNodeId);
          if (window.confirm(`Delete variable "${node?.label}"?`)) {
              setNodes(nodes.filter(n => n.id !== selectedNodeId));
              setLinks(links.filter(l => l.source !== selectedNodeId && l.target !== selectedNodeId));
              setSelectedNodeId(null);
          }
      } else if (selectedLinkIndex !== null) {
          if (window.confirm("Delete this link?")) {
              setLinks(links.filter((_, i) => i !== selectedLinkIndex));
              setSelectedLinkIndex(null);
          }
      }
  };

  const getStyles = () => {
      switch(theme) {
          case 'dark': return { 
              bg: 'bg-slate-900', border: 'border-slate-800', text: 'text-slate-100', 
              nodeLatent: 'border-slate-400 bg-slate-800 text-white',
              nodeObserved: 'border-cyan-500 bg-slate-900 text-cyan-300',
              nodeError: 'border-slate-600 bg-slate-900 text-slate-400',
              btn: 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white',
              btnActive: 'bg-cyan-900 border-cyan-700 text-cyan-100'
          };
          case 'corporate': return { 
              bg: 'bg-white', border: 'border-blue-100', text: 'text-slate-800', 
              nodeLatent: 'border-blue-800 bg-blue-50 text-blue-900',
              nodeObserved: 'border-blue-400 bg-white text-blue-700',
              nodeError: 'border-gray-300 bg-gray-50 text-gray-500',
              btn: 'bg-white border-blue-200 text-blue-500 hover:text-blue-700 hover:bg-blue-50',
              btnActive: 'bg-blue-100 border-blue-300 text-blue-800'
          };
          case 'academic': return { 
              bg: 'bg-[#fdfbf7]', border: 'border-[#e5e0d8]', text: 'text-[#333]', 
              nodeLatent: 'border-[#5d4037] bg-[#efebe9] text-[#3e2723]',
              nodeObserved: 'border-[#8d6e63] bg-white text-[#5d4037]',
              nodeError: 'border-[#a1887f] bg-[#fdfbf7] text-[#a1887f]',
              btn: 'bg-white border-[#d7ccc8] text-[#5d4037] hover:bg-[#efebe9]',
              btnActive: 'bg-[#d7ccc8] border-[#a1887f] text-[#3e2723]'
          };
          default: return { 
              bg: 'bg-slate-50', border: 'border-gray-200', text: 'text-slate-900', 
              nodeLatent: 'border-slate-800 bg-white text-slate-900',
              nodeObserved: 'border-cyan-600 bg-cyan-50 text-slate-900',
              nodeError: 'border-gray-400 bg-white text-gray-500',
              btn: 'bg-white border-gray-200 text-gray-500 hover:text-slate-900 hover:bg-gray-100',
              btnActive: 'bg-cyan-50 border-cyan-200 text-cyan-700'
          };
      }
  };
  const s = getStyles();

  const SquareBtn = ({ onClick, active = false, disabled = false, title, children, className = '' }: any) => (
      <button 
          onClick={onClick} 
          disabled={disabled}
          title={title}
          className={`w-9 h-9 p-0 rounded-lg flex items-center justify-center transition-all shadow-sm border ${active ? s.btnActive : s.btn} ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${className}`}
      >
          {children}
      </button>
  );

  return (
    <div className={`flex flex-col h-full ${s.bg}`}>
      <div className={`p-4 border-b flex justify-between items-center ${s.bg} ${s.border}`}>
        <div>
            <h3 className={`text-lg font-bold font-serif ${s.text}`}>Research Canvas</h3>
            <p className={`text-xs opacity-60`}>Conceptual & Structural Model</p>
        </div>
        <div className={`flex rounded p-1 gap-1 border ${s.border}`}>
             <button 
                onClick={() => setViewMode('canvas')} 
                className={`px-3 py-1 text-xs rounded transition-all ${viewMode === 'canvas' ? s.btnActive : 'opacity-60 hover:opacity-100'}`}
             >
                 Interactive
             </button>
             <button 
                onClick={() => setViewMode('mermaid')} 
                className={`px-3 py-1 text-xs rounded transition-all ${viewMode === 'mermaid' ? s.btnActive : 'opacity-60 hover:opacity-100'}`}
             >
                 Mermaid
             </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4">
        {viewMode === 'canvas' ? (
             <div 
                className={`w-full h-full rounded-xl shadow-inner border relative overflow-auto ${s.bg} ${s.border}`}
                onMouseMove={handleMouseMove}
                onClick={() => { setSelectedNodeId(null); setSelectedLinkIndex(null); }}
             >
             
             {/* Toolbar inside Canvas */}
             <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
                 <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <SquareBtn onClick={createNewModel} title="New Model"><FilePlus size={18} /></SquareBtn>
                        <SquareBtn onClick={handleExportJSON} title="Save File (JSON)"><Download size={18} /></SquareBtn>
                        <label className="cursor-pointer">
                            <SquareBtn onClick={() => fileInputRef.current?.click()} title="Open File (JSON)">
                                <Upload size={18} />
                            </SquareBtn>
                            <input type="file" ref={fileInputRef} onChange={handleImportJSON} accept=".json" className="hidden" />
                        </label>
                    </div>
                 </div>

                 <div className={`h-px w-full ${isDark ? 'bg-slate-700' : 'bg-gray-300'}`}></div>

                 <div className="flex gap-2">
                    <SquareBtn onClick={autoLayout} title="Auto Layout (Magic Wand)" className="text-purple-500 border-purple-200 bg-purple-50 hover:bg-purple-100"><Wand2 size={18} /></SquareBtn>
                    <SquareBtn onClick={() => addNode('error')} title="Add Error Term (Circle)"><Circle size={18} /></SquareBtn>
                 </div>

                 <div className={`h-px w-full ${isDark ? 'bg-slate-700' : 'bg-gray-300'}`}></div>

                 <div className="flex gap-2">
                     <SquareBtn 
                        onClick={() => { setInteractionMode('move'); setLinkingSourceId(null); setTempLineEnd(null); }}
                        active={interactionMode === 'move'}
                        title="Move Mode"
                     >
                         <MousePointer2 size={18} />
                     </SquareBtn>
                     <SquareBtn 
                        onClick={() => { setInteractionMode('link'); setLinkingSourceId(null); }}
                        active={interactionMode === 'link'}
                        title="Link Mode"
                     >
                         <LinkIcon size={18} />
                     </SquareBtn>
                 </div>

                 {/* Link Type Selector */}
                 {interactionMode === 'link' && (
                     <div className={`p-1 rounded-lg border flex gap-1 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                         <button
                            onClick={() => setLinkType('directed')}
                            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${linkType === 'directed' ? (isDark ? 'bg-cyan-900 text-cyan-200' : 'bg-cyan-50 text-cyan-700') : 'opacity-40 hover:opacity-100'}`}
                            title="Directed Arrow"
                         >
                            <LinkIcon size={14} />
                         </button>
                         <button
                            onClick={() => setLinkType('covariance')}
                            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${linkType === 'covariance' ? (isDark ? 'bg-cyan-900 text-cyan-200' : 'bg-cyan-50 text-cyan-700') : 'opacity-40 hover:opacity-100'}`}
                            title="Covariance (Double Headed)"
                         >
                            <ArrowLeftRight size={14} />
                         </button>
                     </div>
                 )}

                 <div className={`h-px w-full ${isDark ? 'bg-slate-700' : 'bg-gray-300'}`}></div>
                 
                 <div className="flex gap-2">
                     <SquareBtn onClick={undo} disabled={historyIndex <= 0} title="Undo"><Undo2 size={18} /></SquareBtn>
                     <SquareBtn onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo"><Redo2 size={18} /></SquareBtn>
                 </div>

                 <div className={`h-px w-full ${isDark ? 'bg-slate-700' : 'bg-gray-300'}`}></div>

                 <SquareBtn 
                    onClick={handleDeleteSelected}
                    disabled={!selectedNodeId && selectedLinkIndex === null}
                    className={`${(selectedNodeId || selectedLinkIndex !== null) ? 'bg-red-50 border-red-200 text-red-500 hover:bg-red-100' : ''}`}
                    title="Delete Selected"
                 >
                     <Trash2 size={18} />
                 </SquareBtn>
             </div>

             <svg className="w-full h-full pointer-events-none absolute top-0 left-0 z-0">
                <defs>
                   <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                     <polygon points="0 0, 10 3.5, 0 7" fill={isDark ? "#94a3b8" : "#64748b"} />
                   </marker>
                   {/* Double Headed Start Marker - refX adjusted to point outwards */}
                   <marker id="arrowhead-start" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                     <polygon points="10 0, 0 3.5, 10 7" fill={isDark ? "#94a3b8" : "#64748b"} />
                   </marker>
                   
                   <marker id="arrowhead-selected" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                     <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
                   </marker>
                   <marker id="arrowhead-start-selected" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                     <polygon points="10 0, 0 3.5, 10 7" fill="#ef4444" />
                   </marker>
                </defs>
                {links.map((link, idx) => {
                    const source = nodes.find(n => n.id === link.source);
                    const target = nodes.find(n => n.id === link.target);
                    if (!source || !target) return null;
                    const isSelected = selectedLinkIndex === idx;
                    const color = isSelected ? '#ef4444' : (isDark ? "#94a3b8" : "#64748b");
                    
                    // Offset calculations based on node type
                    const sW = source.type === 'latent' ? 100 : (source.type === 'error' ? 30 : 120);
                    const sH = source.type === 'latent' ? 50 : (source.type === 'error' ? 30 : 50);
                    const tW = target.type === 'latent' ? 100 : (target.type === 'error' ? 30 : 120);
                    const tH = target.type === 'latent' ? 50 : (target.type === 'error' ? 30 : 50);

                    // Simple center-to-center for now
                    const x1 = source.x + sW / 2;
                    const y1 = source.y + sH / 2;
                    const x2 = target.x + tW / 2;
                    const y2 = target.y + tH / 2;

                    return (
                        <g key={idx} onClick={(e) => handleLinkClick(idx, e)} className="pointer-events-auto cursor-pointer">
                            <line 
                               x1={x1} y1={y1} x2={x2} y2={y2}
                               stroke="transparent"
                               strokeWidth="15"
                            />
                            <line 
                               x1={x1} y1={y1} x2={x2} y2={y2}
                               stroke={color} 
                               strokeWidth={isSelected ? "3" : "2"}
                               markerEnd={isSelected ? "url(#arrowhead-selected)" : "url(#arrowhead)"}
                               markerStart={link.type === 'covariance' ? (isSelected ? "url(#arrowhead-start-selected)" : "url(#arrowhead-start)") : undefined}
                               strokeDasharray={link.type === 'covariance' ? "5,5" : undefined}
                            />
                        </g>
                    )
                })}
                {linkingSourceId && tempLineEnd && (() => {
                    const source = nodes.find(n => n.id === linkingSourceId);
                    if (!source) return null;
                    const sW = source.type === 'latent' ? 100 : (source.type === 'error' ? 30 : 120);
                    const sH = source.type === 'latent' ? 50 : (source.type === 'error' ? 30 : 50);
                    return (
                        <line 
                           x1={source.x + sW/2} 
                           y1={source.y + sH/2} 
                           x2={tempLineEnd.x} 
                           y2={tempLineEnd.y} 
                           stroke={isDark ? "#cbd5e1" : "#94a3b8"} 
                           strokeWidth="2"
                           strokeDasharray="5,5"
                        />
                    )
                })()}
             </svg>
             
             {nodes.map((node) => {
               // Render logic for different node types
               const isLatent = node.type === 'latent';
               const isError = node.type === 'error';
               const width = isLatent ? 100 : (isError ? 30 : 120);
               const height = isLatent ? 50 : (isError ? 30 : 50);
               const radiusClass = isLatent || isError ? 'rounded-full' : 'rounded-sm';
               const styleClass = isLatent ? s.nodeLatent : (isError ? s.nodeError : s.nodeObserved);

               return (
               <div
                 key={node.id}
                 onClick={(e) => { e.stopPropagation(); handleNodeClick(node.id); }}
                 className={`absolute flex items-center justify-center shadow-lg transition-all z-10 border
                    ${interactionMode === 'move' ? 'cursor-move' : 'cursor-pointer'}
                    ${linkingSourceId === node.id ? 'ring-4 ring-yellow-400 scale-105' : ''}
                    ${selectedNodeId === node.id ? 'ring-2 ring-red-500' : ''}
                    ${styleClass} ${radiusClass}
                 `}
                 style={{ left: node.x, top: node.y, width: `${width}px`, height: `${height}px` }}
                 draggable={interactionMode === 'move'}
                 onDragEnd={(e) => {
                    if (interactionMode !== 'move') return;
                    const rect = (e.target as HTMLElement).parentElement?.getBoundingClientRect();
                    if(rect) {
                        const newX = e.clientX - rect.left - (width / 2);
                        const newY = e.clientY - rect.top - (height / 2);
                        setNodes(nodes.map(n => n.id === node.id ? {...n, x: newX, y: newY} : n));
                    }
                 }}
               >
                 <span className={`${isError ? 'text-[10px]' : 'text-xs px-2'} truncate select-none`}>{node.label}</span>
               </div>
             )})}
           </div>
        ) : (
            <div className={`w-full h-full rounded-xl shadow-inner border overflow-auto p-4 flex justify-center ${s.bg} ${s.border}`}>
                <div className="mermaid" ref={mermaidRef}>
                    {mermaidSyntax}
                </div>
            </div>
        )}
      </div>

      <div className={`p-4 border-t space-y-2 ${s.bg} ${s.border}`}>
          <div className="flex gap-2 mb-2">
              <label className={`flex items-center gap-2 text-xs opacity-80 cursor-pointer`}>
                  <input type="radio" checked={nodeType === 'latent'} onChange={() => setNodeType('latent')} /> Latent (O)
              </label>
              <label className={`flex items-center gap-2 text-xs opacity-80 cursor-pointer`}>
                  <input type="radio" checked={nodeType === 'observed'} onChange={() => setNodeType('observed')} /> Observed ([])
              </label>
              <label className={`flex items-center gap-2 text-xs opacity-80 cursor-pointer`}>
                  <input type="radio" checked={nodeType === 'error'} onChange={() => setNodeType('error')} /> Error (e)
              </label>
          </div>
          <div className="flex gap-2">
            <input 
                type="text" 
                value={newNodeLabel}
                onChange={(e) => setNewNodeLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addNode(); }}
                placeholder="Variable Name... (Enter to Add)"
                className={`flex-1 px-3 py-2 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 ${isDark ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-gray-300 text-slate-900'}`}
            />
            <button onClick={() => addNode()} className={`px-3 py-2 rounded flex items-center gap-2 text-sm transition-colors ${s.btnActive}`}>
                <PlusCircle size={16} /> Add
            </button>
          </div>
          <div className={`text-[10px] opacity-60`}>
              Use Link Mode with "Double Arrow" for covariance. Use "Download" to save your work properly.
          </div>
      </div>
    </div>
  );
};

export default ModelPreview;
