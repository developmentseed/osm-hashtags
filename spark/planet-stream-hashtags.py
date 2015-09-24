import sys
import json
from itertools import tee, izip
from shapely.geometry import Point, LineString, Polygon
from shapely import wkt
import redis

from pyspark import SparkContext
from pyspark.streaming import StreamingContext
from pyspark.streaming.kinesis import KinesisUtils, InitialPositionInStream

def addHashtags(obj):
    s = obj['metadata']['comment']
    obj['hashtags'] = list(set(part[1:] for part in s.split() if part.startswith('#')))
    return obj

def has_tag(tag):
    return lambda obj: tag in obj['tags']

def either(lambda1, lambda2):
    return lambda arg: lambda1(arg) or lambda2(arg)

def processFeature(obj):
    nodes = obj['nodes']
    nodelist = []
    feature = {}
    for ref in nodes:
        nodelist.append(( float(ref['lon']), float(ref['lat'])))
#    print nodelist

    if has_tag('building')(obj):
        feature = Polygon(nodelist)
    else:
        feature = LineString(nodelist)

    return {'user': obj['user'],
            'id': obj['id'],
            'changeset': obj['metadata']['id'],
            'date': obj['metadata']['created_at'],
            'feature': wkt.dumps(feature),
            'action': obj['action'],
            'comment': obj['metadata']['comment'],
            'hashtags': obj['hashtags']
            }

def ensureComment(obj):
    if 'comment' not in obj['metadata']:
        obj['metadata']['comment'] = '(no comment)'

    return obj

def outputHashtags(partition):
    r = redis.StrictRedis(host='localhost', port=6379, db=0)
    pipe = r.pipeline()
    for record in partition:
        pipe.lpush('hashtags:list:' + record[1], record[0])
        pipe.publish('hashtagsch', record)
    pipe.execute()

def outputTrending(partition, time):
    r = redis.StrictRedis(host='localhost', port=6379, db=0)
    pipe = r.pipeline()
    for record in partition:
        pipe.set('hashtags:score:' + time + ':' + record[0], record[1])
        pipe.publish('hashtagsch', record)
    pipe.execute()
    
def outputFeatures(partition):
    r = redis.StrictRedis(host='localhost', port=6379, db=0)
    pipe = r.pipeline()
    for record in partition:
        rec = json.dumps(record)
        pipe.lpush('features', rec)
        pipe.publish('featuresch', rec)
    pipe.ltrim('features', 0, 1000)
    pipe.execute()

def createContext(checkpoint):
    sc = SparkContext(master="local[*]", appName="PlanetStreamHashtags")
    ssc = StreamingContext(sc, 30)

    appName = "PlanetStreamHashtags"
    streamName = "test"
    endpointUrl = "https://kinesis.us-west-1.amazonaws.com"
    regionName = "us-west-1"
    lines = KinesisUtils.createStream(
        ssc, appName, streamName, endpointUrl, regionName, InitialPositionInStream.LATEST, 60,
        decoder=lambda obj:obj)
    relevantLines = (lines.map(lambda line: json.loads(line))
            .filter(lambda obj: obj['type'] == 'way')
            .map(ensureComment)
            .map(addHashtags)
            )

    features = (relevantLines
            .filter(either(has_tag('building'), has_tag('highway')))
            .map(processFeature))

    features.foreachRDD(lambda rdd: rdd.foreachPartition(outputFeatures))

    hashtagFeatures = features.flatMap(lambda obj: [(obj['feature'], hashtag) for hashtag in obj['hashtags']])
    hashtagFeatures.foreachRDD(lambda rdd: rdd.foreachPartition(outputHashtags))

    hashtagFeatures.pprint()

    hashtags6 = (
        features.flatMap(lambda obj: [(hashtag,1) for hashtag in obj['hashtags']])
        .reduceByKeyAndWindow(lambda x, y: x + y, lambda x, y: x - y, 6 * 3600, 30)
        )
    hashtags6.pprint()

#    hashtags12 = (
#        features.flatMap(lambda obj: [(hashtag,1) for hashtag in obj['hashtags']])
#        .reduceByKeyAndWindow(lambda x, y: x + y, lambda x, y: x - y, 12 * 3600, 10)
#        )
#    hashtags24 = (
#        features.flatMap(lambda obj: [(hashtag,1) for hashtag in obj['hashtags']])
#        .reduceByKeyAndWindow(lambda x, y: x + y, lambda x, y: x - y, 24 * 3600, 10)
#        )

    hashtags6.foreachRDD(lambda rdd: rdd.foreachPartition(lambda partition: outputTrending(partition, '6')))
#    hashtags12.foreachRDD(lambda rdd: rdd.foreachPartition(lambda partition: outputTrending(partition, '12')))
#    hashtags24.foreachRDD(lambda rdd: rdd.foreachPartition(lambda partition: outputTrending(partition, '24')))

    ssc.checkpoint(checkpoint)
    return ssc

if __name__ == "__main__":
    checkpoint = "checkpoint" 
    ssc = StreamingContext.getOrCreate(checkpoint, lambda: createContext(checkpoint))
    ssc.start()
    ssc.awaitTermination()
