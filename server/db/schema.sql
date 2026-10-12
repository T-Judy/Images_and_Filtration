-- PostgreSQL schema for the Status Effects app.

-- StatusEffect model
CREATE TABLE IF NOT EXISTS status_effects (
    id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    -- Store only the path *relative to the media root*
    icon         VARCHAR(255) NOT NULL,
    description  TEXT         NOT NULL,
    -- PositiveIntegerField -> INTEGER with a CHECK (>= 0)
    max_potency  INTEGER      NOT NULL DEFAULT 1 CHECK (max_potency >= 0),
    max_stack    INTEGER      NOT NULL DEFAULT 1 CHECK (max_stack   >= 0)
);

-- related_effects 
CREATE TABLE IF NOT EXISTS status_effect_relations (
    effect_id  INTEGER NOT NULL REFERENCES status_effects(id) ON DELETE CASCADE,
    related_id INTEGER NOT NULL REFERENCES status_effects(id) ON DELETE CASCADE,
    PRIMARY KEY (effect_id, related_id),
    CHECK (effect_id <> related_id)
);

CREATE INDEX IF NOT EXISTS status_effect_relations_related_id_idx
    ON status_effect_relations (related_id);
