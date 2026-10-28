import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SERVER_CODENAMES, codenameForProvider, providerForCodename } from '../src/lib/servers';

describe('servers (codenames)', () => {
  it('maps every provider from spec §6.6 to a codename', () => {
    assert.equal(SERVER_CODENAMES.size, 17);
    assert.equal(codenameForProvider('netmirror'), 'NOVA');
    assert.equal(codenameForProvider('vixsrc'), 'VESPER');
    assert.equal(codenameForProvider('vidlink'), 'ORION');
    assert.equal(codenameForProvider('videasy'), 'LYRA');
    assert.equal(codenameForProvider('zxcstreams'), 'KESTREL');
    assert.equal(codenameForProvider('vaplayer'), 'HALCYON');
    assert.equal(codenameForProvider('showbox'), 'MERIDIAN');
    assert.equal(codenameForProvider('4khdhub'), 'ATLAS');
    assert.equal(codenameForProvider('castletv'), 'CITADEL');
    assert.equal(codenameForProvider('dahmermovies'), 'DUNE');
    assert.equal(codenameForProvider('hdghartv'), 'HELIOS');
    assert.equal(codenameForProvider('onetouchtv'), 'ONYX');
    assert.equal(codenameForProvider('streamflix'), 'NOCTIS');
    assert.equal(codenameForProvider('rive apogee'), 'PRIME');
    assert.equal(codenameForProvider('rive vanguard'), 'STELLAR');
    assert.equal(codenameForProvider('rive pulse'), 'NEXUS');
    assert.equal(codenameForProvider('rive citadel'), 'ORBIT');
  });

  it('round-trips codename <-> provider', () => {
    assert.equal(providerForCodename('NOVA'), 'netmirror');
    assert.equal(providerForCodename('noctis'), 'streamflix');
    assert.equal(providerForCodename('STELLAR'), 'rive vanguard');
    assert.equal(providerForCodename('ORBIT'), 'rive citadel');
    assert.equal(providerForCodename('UNKNOWN'), null);
    assert.equal(codenameForProvider('unknown'), null);
  });

  it('is case-insensitive on lookup', () => {
    assert.equal(providerForCodename('nova'), 'netmirror');
    assert.equal(codenameForProvider('VIXSRC'), 'VESPER');
  });
});
