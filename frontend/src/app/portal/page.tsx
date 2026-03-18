'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, ArrowRight, MapPin } from 'lucide-react';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

interface Center {
  id: string;
  center_name: string | null;
  center_code: string | null;
}

export default function PortalPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Center[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/public/centers?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setResults(json.data ?? json);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      {/* Hero */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Encuentra tu centro</h1>
        <p className="text-gray-500 text-lg">
          Busca por nombre o código para ver los eventos disponibles y reservar tu lugar.
        </p>
      </div>

      {/* Search input */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busca por nombre o código del centro..."
          className="w-full pl-12 pr-4 py-4 text-base border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Results */}
      {loading && (
        <div className="text-center text-gray-400 py-8">Buscando...</div>
      )}

      {!loading && results.length === 0 && query.length > 0 && (
        <div className="text-center text-gray-400 py-8">
          No se encontraron centros para &ldquo;{query}&rdquo;
        </div>
      )}

      {!loading && results.length === 0 && query.length === 0 && (
        <div className="text-center text-gray-300 py-8">
          <MapPin className="h-12 w-12 mx-auto mb-3" />
          <p>Escribe para buscar centros disponibles</p>
        </div>
      )}

      <div className="space-y-3">
        {results.map((center) => (
          <div
            key={center.id}
            className="flex items-center justify-between p-5 border border-gray-100 rounded-xl hover:border-blue-200 hover:shadow-sm transition-all bg-white"
          >
            <div>
              <h2 className="font-semibold text-gray-900">
                {center.center_name || center.center_code || 'Centro sin nombre'}
              </h2>
              {center.center_code && (
                <p className="text-sm text-gray-400 mt-0.5">/{center.center_code}</p>
              )}
            </div>
            {center.center_code && (
              <Link
                href={`/portal/${center.center_code}`}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Ver eventos
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
