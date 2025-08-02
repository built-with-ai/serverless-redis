'use client';

import { useState, useEffect } from 'react';

interface CrudState {
  key: string;
  value: string;
  result: string;
  loading: boolean;
}

export function CrudDemo() {
  const [state, setState] = useState<CrudState>({
    key: 'demo-key',
    value: 'demo-value',
    result: '',
    loading: false
  });

  const updateState = (updates: Partial<CrudState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const performOperation = async (operation: string, method: string, body?: any) => {
    updateState({ loading: true, result: '' });
    
    try {
      const response = await fetch('/api/crud', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      
      const data = await response.json();
      updateState({ 
        result: `${operation}: ${JSON.stringify(data, null, 2)}`,
        loading: false 
      });
    } catch (error) {
      updateState({ 
        result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        loading: false 
      });
    }
  };

  const handleSet = () => {
    performOperation('SET', 'POST', { 
      key: state.key, 
      value: state.value,
      timestamp: new Date().toISOString()
    });
  };

  const handleGet = () => {
    performOperation('GET', 'GET', { key: state.key });
  };

  const handleDelete = () => {
    performOperation('DELETE', 'DELETE', { key: state.key });
  };

  const handleIncrement = () => {
    performOperation('INCREMENT', 'POST', { 
      key: 'counter', 
      action: 'incr' 
    });
  };

  const handlePipeline = () => {
    performOperation('PIPELINE', 'POST', { 
      action: 'pipeline',
      commands: [
        { command: 'set', args: ['pipe1', 'value1'] },
        { command: 'set', args: ['pipe2', 'value2'] },
        { command: 'get', args: ['pipe1'] },
        { command: 'get', args: ['pipe2'] }
      ]
    });
  };

  return (
    <div className="space-y-4">
      {/* Input Fields */}
      <div className="space-y-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Key
          </label>
          <input
            type="text"
            value={state.key}
            onChange={(e) => updateState({ key: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter Redis key"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Value
          </label>
          <input
            type="text"
            value={state.value}
            onChange={(e) => updateState({ value: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter Redis value"
          />
        </div>
      </div>

      {/* Operation Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleSet}
          disabled={state.loading}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          SET
        </button>
        
        <button
          onClick={handleGet}
          disabled={state.loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          GET
        </button>
        
        <button
          onClick={handleDelete}
          disabled={state.loading}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          DELETE
        </button>
        
        <button
          onClick={handleIncrement}
          disabled={state.loading}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
        >
          INCR
        </button>
        
        <button
          onClick={handlePipeline}
          disabled={state.loading}
          className="col-span-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
        >
          PIPELINE
        </button>
      </div>

      {/* Loading Indicator */}
      {state.loading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Result Display */}
      {state.result && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Result
          </label>
          <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto border">
            {state.result}
          </pre>
        </div>
      )}
    </div>
  );
}